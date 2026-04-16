import type { IDataObject } from 'n8n-workflow';

/**
 * FreshRSS Google Reader API 中的系统状态标签
 */
const STATE_READ = 'user/-/state/com.google/read';
const STATE_STARRED = 'user/-/state/com.google/starred';
const STATE_READING_LIST = 'user/-/state/com.google/reading-list';

/**
 * 构建 API 请求参数的结果
 */
export interface IApiRequestParams {
	endpoint: string;
	query: IDataObject;
}

/**
 * 从简单模式筛选参数构建 API 请求参数
 */
export function buildSimpleFilterParams(params: {
	category?: string;
	feed?: string;
	tag?: string;
	status?: string;
	startTime?: string;
	endTime?: string;
	count?: number;
	order?: string;
	continuation?: string;
}): IApiRequestParams {
	const query: IDataObject = {
		output: 'json',
	};

	// 确定 stream ID（决定从哪个流获取文章）
	let streamId = STATE_READING_LIST; // 默认获取所有文章

	if (params.feed) {
		streamId = params.feed; // feed/xxx 格式
	} else if (params.category) {
		streamId = params.category; // user/-/label/xxx 格式
	} else if (params.tag) {
		streamId = params.tag; // user/-/label/xxx 格式
	}

	// 状态筛选
	if (params.status === 'unread') {
		// 排除已读文章
		query.xt = STATE_READ;
	} else if (params.status === 'read') {
		// 仅获取已读文章：从 reading-list 中筛选包含 read 状态的
		query.it = STATE_READ;
	} else if (params.status === 'starred') {
		// 仅获取已加星文章
		streamId = STATE_STARRED;
	}

	// 时间范围
	if (params.startTime) {
		const startTimestamp = Math.floor(new Date(params.startTime).getTime() / 1000);
		if (!isNaN(startTimestamp)) {
			query.ot = startTimestamp;
		}
	}
	if (params.endTime) {
		const endTimestamp = Math.floor(new Date(params.endTime).getTime() / 1000);
		if (!isNaN(endTimestamp)) {
			query.nt = endTimestamp;
		}
	}

	// 数量限制
	if (params.count) {
		query.n = params.count;
	}

	// 排序
	if (params.order === 'oldest') {
		query.r = 'o';
	}

	// 分页
	if (params.continuation) {
		query.c = params.continuation;
	}

	// 构建 endpoint：stream/contents/{streamId}
	const encodedStreamId = encodeURIComponent(streamId);
	const endpoint = `reader/api/0/stream/contents/${encodedStreamId}`;

	return { endpoint, query };
}

/**
 * 从组合模式筛选参数构建 API 请求参数
 *
 * 注意：Google Reader API 对组合筛选的支持有限。
 * - AND 模式：使用主 stream + xt/it 参数进行交叉筛选
 * - OR 模式：需要发起多个请求然后合并结果
 */
export function buildCombinedFilterParams(params: {
	combinationMode: string;
	conditions: Array<{
		filterType: string;
		category?: string;
		feed?: string;
		tag?: string;
		status?: string;
		startTime?: string;
		endTime?: string;
	}>;
	count?: number;
	order?: string;
}): IApiRequestParams[] {
	if (!params.conditions || params.conditions.length === 0) {
		// 无条件，返回默认的全部文章
		return [buildSimpleFilterParams({ count: params.count, order: params.order })];
	}

	if (params.combinationMode === 'or') {
		// OR 模式：每个条件独立请求，后续合并去重
		return params.conditions.map((condition) => {
			const simpleParams: Record<string, string | number | undefined> = {
				count: params.count,
				order: params.order,
			};

			switch (condition.filterType) {
				case 'category':
					simpleParams.category = condition.category;
					break;
				case 'feed':
					simpleParams.feed = condition.feed;
					break;
				case 'tag':
					simpleParams.tag = condition.tag;
					break;
				case 'status':
					simpleParams.status = condition.status;
					break;
				case 'timeRange':
					simpleParams.startTime = condition.startTime;
					simpleParams.endTime = condition.endTime;
					break;
			}

			return buildSimpleFilterParams(simpleParams as Parameters<typeof buildSimpleFilterParams>[0]);
		});
	}

	// AND 模式：尝试将多个条件合并到一个请求中
	// 优先级：feed > category > tag 作为主 stream
	// 状态和时间作为附加参数
	const mergedParams: {
		category?: string;
		feed?: string;
		tag?: string;
		status?: string;
		startTime?: string;
		endTime?: string;
		count?: number;
		order?: string;
	} = {
		count: params.count,
		order: params.order,
	};

	for (const condition of params.conditions) {
		switch (condition.filterType) {
			case 'category':
				mergedParams.category = condition.category;
				break;
			case 'feed':
				mergedParams.feed = condition.feed;
				break;
			case 'tag':
				mergedParams.tag = condition.tag;
				break;
			case 'status':
				mergedParams.status = condition.status;
				break;
			case 'timeRange':
				if (condition.startTime) mergedParams.startTime = condition.startTime;
				if (condition.endTime) mergedParams.endTime = condition.endTime;
				break;
		}
	}

	return [buildSimpleFilterParams(mergedParams)];
}

/**
 * 对多个请求结果进行合并去重（用于 OR 模式）
 */
export function deduplicateArticles<T extends { id: string }>(articles: T[]): T[] {
	const seen = new Set<string>();
	const result: T[] = [];
	for (const article of articles) {
		if (!seen.has(article.id)) {
			seen.add(article.id);
			result.push(article);
		}
	}
	return result;
}
