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
	getPostToken,
} from './GenericFunctions';

import { articleFilterProperties } from './descriptions/ArticleFilterDescription';
import { articleUpdateProperties } from './descriptions/ArticleUpdateDescription';
import {
	buildSimpleFilterParams,
	buildCombinedFilterParams,
	deduplicateArticles,
} from './helpers/FilterBuilder';

import type { IStreamContentsResponse, IArticleItem, IFormattedArticle } from './types';

/**
 * 为 Get 操作的参数添加 operation displayOptions 条件
 * 由于 articleFilterProperties 被 Trigger 节点共用，不能直接修改原始定义
 * 这里对每个属性进行浅拷贝并注入 operation 条件
 */
function addOperationCondition(
	properties: INodeTypeDescription['properties'],
	operationValue: string,
): INodeTypeDescription['properties'] {
	return properties.map((prop) => {
		const existing = prop.displayOptions?.show || {};
		return {
			...prop,
			displayOptions: {
				...prop.displayOptions,
				show: {
					...existing,
					operation: [operationValue],
				},
			},
		};
	});
}

export class Freshrss implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'FreshRSS',
		name: 'freshrss',
		icon: { light: 'file:freshrss.svg', dark: 'file:freshrss.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] === "updateArticle" ? "Update: " + $parameter["updateAction"] : ($parameter["filterMode"] === "simple" ? "Get Articles" : "Get Articles (Combined)")}}',
		description: 'Get and update articles from FreshRSS',
		defaults: {
			name: 'FreshRSS',
		},
		usableAsTool: true,
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'freshrssApi', required: true }],
		properties: [
			// Operation 选择器（最前面）
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Get Articles',
						value: 'getArticles',
						description: 'Get articles from FreshRSS with flexible filtering',
						action: 'Get articles from FreshRSS',
					},
					{
						name: 'Update Article',
						value: 'updateArticle',
						description: 'Update article status (read, starred, tags)',
						action: 'Update article status',
					},
				],
				default: 'getArticles',
			},
			// Get 操作的参数（注入 operation 条件）
			...addOperationCondition(articleFilterProperties, 'getArticles'),
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				description: 'Whether to return all results or only up to a given limit',
				displayOptions: {
					show: {
						operation: ['getArticles'],
					},
				},
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
						operation: ['getArticles'],
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
				displayOptions: {
					show: {
						operation: ['getArticles'],
					},
				},
			},
			// Update 操作的参数
			...articleUpdateProperties,
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
				const operation = this.getNodeParameter('operation', i, 'getArticles') as string;

				if (operation === 'getArticles') {
					// ===== Get Articles 操作（原有逻辑） =====
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

						if (combinationMode === 'or') {
							allArticles = deduplicateArticles(allArticles);
						}
					}

					if (limit && allArticles.length > limit) {
						allArticles = allArticles.slice(0, limit);
					}

					const formattedArticles: IFormattedArticle[] = allArticles.map(formatArticle);

					for (const article of formattedArticles) {
						returnData.push({
							json: article as unknown as IDataObject,
							pairedItem: { item: i },
						});
					}
				} else if (operation === 'updateArticle') {
					// ===== Update Article 操作 =====
					const updateAction = this.getNodeParameter('updateAction', i) as string;
					const token = await getPostToken.call(this);

					if (updateAction === 'markAllAsRead') {
						// 批量标记全部已读
						const scope = this.getNodeParameter('markAllAsReadScope', i) as string;
						const markAllTimestamp = this.getNodeParameter('markAllTimestamp', i, '') as string;

						let streamId: string;
						if (scope === 'feed') {
							streamId = this.getNodeParameter('markAllFeed', i) as string;
						} else if (scope === 'category') {
							streamId = this.getNodeParameter('markAllCategory', i) as string;
						} else {
							streamId = 'user/-/state/com.google/reading-list';
						}

						let formBody = `s=${encodeURIComponent(streamId)}&T=${encodeURIComponent(token)}`;

						if (markAllTimestamp) {
							const ts = Math.floor(new Date(markAllTimestamp).getTime() / 1000);
							if (!isNaN(ts)) {
								formBody += `&ts=${ts}`;
							}
						}

						await freshrssApiRequest.call(
							this,
							'POST',
							'reader/api/0/mark-all-as-read',
							formBody,
						);

						returnData.push({
							json: {
								success: true,
								action: 'markAllAsRead',
								scope,
								streamId,
							},
							pairedItem: { item: i },
						});
					} else {
						// 单篇/多篇文章操作（edit-tag）
						const articleIdsRaw = this.getNodeParameter('articleIds', i) as string;
						const articleIds = articleIdsRaw
							.split(',')
							.map((id) => id.trim())
							.filter((id) => id !== '');

						// 根据动作确定要添加(a)或移除(r)的标签
						let addTag = '';
						let removeTag = '';

						switch (updateAction) {
							case 'markAsRead':
								addTag = 'user/-/state/com.google/read';
								break;
							case 'markAsUnread':
								removeTag = 'user/-/state/com.google/read';
								break;
							case 'star':
								addTag = 'user/-/state/com.google/starred';
								break;
							case 'unstar':
								removeTag = 'user/-/state/com.google/starred';
								break;
							case 'addTag': {
								const tagName = this.getNodeParameter('tagName', i) as string;
								addTag = `user/-/label/${tagName}`;
								break;
							}
							case 'removeTag': {
								const removeTagId = this.getNodeParameter('removeTagId', i) as string;
								removeTag = removeTagId;
								break;
							}
						}

						// 构建 edit-tag 请求体
						// edit-tag 支持多个 i 参数，使用 & 连接
						const idParams = articleIds
							.map((id) => `i=${encodeURIComponent(id)}`)
							.join('&');

						let formBody = `${idParams}&T=${encodeURIComponent(token)}`;
						if (addTag) {
							formBody += `&a=${encodeURIComponent(addTag)}`;
						}
						if (removeTag) {
							formBody += `&r=${encodeURIComponent(removeTag)}`;
						}

						await freshrssApiRequest.call(
							this,
							'POST',
							'reader/api/0/edit-tag',
							formBody,
						);

						returnData.push({
							json: {
								success: true,
								action: updateAction,
								articleIds,
								...(addTag ? { tagAdded: addTag } : {}),
								...(removeTag ? { tagRemoved: removeTag } : {}),
							},
							pairedItem: { item: i },
						});
					}
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
