import {
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import {
	freshrssApiRequest,
	freshrssApiRequestWithPagination,
	formatArticle,
	getCategories,
	getFeeds,
	getTags,
} from './GenericFunctions';

import { articleFilterProperties } from './descriptions/ArticleFilterDescription';
import {
	buildSimpleFilterParams,
	buildCombinedFilterParams,
	deduplicateArticles,
} from './helpers/FilterBuilder';

import type { IStreamContentsResponse, IArticleItem, IFormattedArticle } from './types';

export class Freshrss implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'FreshRSS',
		name: 'freshrss',
		icon: { light: 'file:freshrss.svg', dark: 'file:freshrss.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["filterMode"] === "simple" ? "Get Articles" : "Get Articles (Combined Filter)"}}',
		description: 'Get articles from FreshRSS with flexible filtering',
		defaults: {
			name: 'FreshRSS',
		},
		usableAsTool: true,
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'freshrssApi', required: true }],
		properties: [
			...articleFilterProperties,
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				description: 'Whether to return all results or only up to a given limit',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				typeOptions: {
					minValue: 1,
					maxValue: 10000,
				},
				description: 'Max number of results to return',
				displayOptions: {
					show: {
						returnAll: [false],
					},
				},
			},
			{
				displayName: 'Sort Order',
				name: 'sortOrder',
				type: 'options',
				options: [
					{
						name: 'Newest First',
						value: 'newest',
						description: 'Most recent articles first (default)',
					},
					{
						name: 'Oldest First',
						value: 'oldest',
						description: 'Oldest articles first',
					},
				],
				default: 'newest',
				description: 'How to sort the returned articles',
			},
		],
	};

	methods = {
		loadOptions: {
			getCategories,
			getFeeds,
			getTags,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const filterMode = this.getNodeParameter('filterMode', i, 'simple') as string;
				const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
				const limit = returnAll ? undefined : (this.getNodeParameter('limit', i, 20) as number);
				const sortOrder = this.getNodeParameter('sortOrder', i, 'newest') as string;

				let allArticles: IArticleItem[] = [];

				if (filterMode === 'simple') {
					const category = this.getNodeParameter('category', i, '') as string;
					const feed = this.getNodeParameter('feed', i, '') as string;
					const tag = this.getNodeParameter('tag', i, '') as string;
					const status = this.getNodeParameter('status', i, 'all') as string;
					const startTime = this.getNodeParameter('startTime', i, '') as string;
					const endTime = this.getNodeParameter('endTime', i, '') as string;

					const filterParams = buildSimpleFilterParams({
						category,
						feed,
						tag,
						status,
						startTime: startTime || undefined,
						endTime: endTime || undefined,
						count: returnAll ? 1000 : limit,
						order: sortOrder,
					});

					if (returnAll) {
						// 使用分页获取全部
						allArticles = await freshrssApiRequestWithPagination.call(
							this,
							'GET',
							filterParams.endpoint,
							filterParams.query,
						);
					} else {
						const response = (await freshrssApiRequest.call(
							this,
							'GET',
							filterParams.endpoint,
							undefined,
							filterParams.query,
						)) as IStreamContentsResponse;

						allArticles = response.items || [];
					}
				} else {
					// 组合筛选模式
					const combinationMode = this.getNodeParameter('combinationMode', i, 'and') as string;
					const filterConditions = this.getNodeParameter('filterConditions', i, {}) as IDataObject;
					const conditions = ((filterConditions.conditions as IDataObject[]) || []).map((c) => ({
						filterType: c.filterType as string,
						category: c.category as string | undefined,
						feed: c.feed as string | undefined,
						tag: c.tag as string | undefined,
						status: c.status as string | undefined,
						startTime: c.startTime as string | undefined,
						endTime: c.endTime as string | undefined,
					}));

					const requestParamsList = buildCombinedFilterParams({
						combinationMode,
						conditions,
						count: returnAll ? 1000 : limit,
						order: sortOrder,
					});

					for (const requestParams of requestParamsList) {
						if (returnAll) {
							const pageArticles = await freshrssApiRequestWithPagination.call(
								this,
								'GET',
								requestParams.endpoint,
								requestParams.query,
							);
							allArticles.push(...pageArticles);
						} else {
							const response = (await freshrssApiRequest.call(
								this,
								'GET',
								requestParams.endpoint,
								undefined,
								requestParams.query,
							)) as IStreamContentsResponse;
							allArticles.push(...(response.items || []));
						}
					}

					// OR 模式需要去重
					if (combinationMode === 'or') {
						allArticles = deduplicateArticles(allArticles);
					}
				}

				// 限制返回数量
				if (limit && allArticles.length > limit) {
					allArticles = allArticles.slice(0, limit);
				}

				// 格式化文章并输出
				const formattedArticles: IFormattedArticle[] = allArticles.map(formatArticle);

				for (const article of formattedArticles) {
					returnData.push({
						json: article as unknown as IDataObject,
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
						},
						pairedItem: { item: i },
					});
					continue;
				}

				const node = this.getNode();
				throw new NodeApiError(node, { message: (error as Error).message } as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
