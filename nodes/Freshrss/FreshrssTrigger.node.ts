import {
	type IDataObject,
	type INodeType,
	type INodeTypeDescription,
	type IPollFunctions,
	type INodeExecutionData,
} from 'n8n-workflow';

import {
	freshrssApiRequest,
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

export class FreshrssTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'FreshRSS Trigger',
		name: 'freshrssTrigger',
		icon: { light: 'file:freshrss.svg', dark: 'file:freshrss.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["filterMode"] === "simple" ? "New Articles" : "New Articles (Combined Filter)"}}',
		description: 'Triggers when new articles appear in FreshRSS',
		defaults: {
			name: 'FreshRSS Trigger',
		},
		polling: true,
		inputs: [],
		outputs: ['main'],
		credentials: [{ name: 'freshrssApi', required: true }],
		properties: [
			...articleFilterProperties,
		],
		usableAsTool: true,
	};

	methods = {
		loadOptions: {
			getCategories,
			getFeeds,
			getTags,
		},
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const staticData = this.getWorkflowStaticData('node');
		const filterMode = this.getNodeParameter('filterMode', 'simple') as string;

		// 获取上次轮询时间戳
		const lastPollTime = staticData.lastPollTime as number | undefined;
		const now = Math.floor(Date.now() / 1000);

		// 首次运行：记录当前时间，不获取历史文章
		if (!lastPollTime) {
			staticData.lastPollTime = now;
			return null;
		}

		let allArticles: IArticleItem[] = [];

		if (filterMode === 'simple') {
			const category = this.getNodeParameter('category', '') as string;
			const feed = this.getNodeParameter('feed', '') as string;
			const tag = this.getNodeParameter('tag', '') as string;
			const status = this.getNodeParameter('status', 'all') as string;
			const startTime = this.getNodeParameter('startTime', '') as string;
			const endTime = this.getNodeParameter('endTime', '') as string;

			const filterParams = buildSimpleFilterParams({
				category,
				feed,
				tag,
				status,
				startTime: startTime || undefined,
				endTime: endTime || undefined,
				count: 100,
			});

			// 强制使用上次轮询时间作为起始时间
			filterParams.query.ot = lastPollTime;

			const response = (await freshrssApiRequest.call(
				this,
				'GET',
				filterParams.endpoint,
				undefined,
				filterParams.query,
			)) as IStreamContentsResponse;

			allArticles = response.items || [];
		} else {
			// 组合筛选模式
			const combinationMode = this.getNodeParameter('combinationMode', 'and') as string;
			const filterConditions = this.getNodeParameter('filterConditions', {}) as IDataObject;
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
				count: 100,
			});

			for (const requestParams of requestParamsList) {
				// 强制使用上次轮询时间
				requestParams.query.ot = lastPollTime;

				const response = (await freshrssApiRequest.call(
					this,
					'GET',
					requestParams.endpoint,
					undefined,
					requestParams.query,
				)) as IStreamContentsResponse;

				allArticles.push(...(response.items || []));
			}

			// OR 模式需要去重
			if (combinationMode === 'or') {
				allArticles = deduplicateArticles(allArticles);
			}
		}

		// 更新轮询时间戳
		staticData.lastPollTime = now;

		// 如果没有新文章，不触发
		if (allArticles.length === 0) {
			return null;
		}

		// 格式化文章并输出
		const formattedArticles: IFormattedArticle[] = allArticles.map(formatArticle);

		const returnData: INodeExecutionData[] = formattedArticles.map((article) => ({
			json: article as unknown as IDataObject,
		}));

		return [returnData];
	}
}
