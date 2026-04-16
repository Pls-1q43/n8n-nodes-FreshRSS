import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	IHookFunctions,
	IPollFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	INodePropertyOptions,
	IDataObject,
	JsonObject,
} from 'n8n-workflow';
/* eslint-disable @n8n/community-nodes/no-http-request-with-manual-auth -- FreshRSS uses Google Reader ClientLogin auth which is not supported by httpRequestWithAuthentication */
import { NodeApiError } from 'n8n-workflow';

import type {
	IClientLoginResponse,
	ITagListResponse,
	ISubscriptionListResponse,
	IArticleItem,
	IFormattedArticle,
} from './types';

// 缓存 Auth Token，避免每次请求都重新认证
const tokenCache: Map<string, { token: string; timestamp: number }> = new Map();
const TOKEN_TTL = 30 * 60 * 1000; // 30 分钟过期

/**
 * 解析 ClientLogin 响应文本为键值对
 */
function parseClientLoginResponse(responseText: string): IClientLoginResponse {
	const lines = responseText.trim().split('\n');
	const result: Record<string, string> = {};
	for (const line of lines) {
		const eqIndex = line.indexOf('=');
		if (eqIndex > 0) {
			const key = line.substring(0, eqIndex).trim();
			const value = line.substring(eqIndex + 1).trim();
			result[key] = value;
		}
	}
	return result as unknown as IClientLoginResponse;
}

/**
 * 获取 FreshRSS Auth Token（ClientLogin 认证）
 */
async function getAuthToken(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IPollFunctions,
): Promise<string> {
	const credentials = await this.getCredentials('freshrssApi');
	const serverUrl = (credentials.serverUrl as string).replace(/\/$/, '');
	const username = credentials.username as string;
	const apiPassword = credentials.apiPassword as string;

	const cacheKey = `${serverUrl}:${username}`;
	const cached = tokenCache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < TOKEN_TTL) {
		return cached.token;
	}

	const url = `${serverUrl}/api/greader.php/accounts/ClientLogin?Email=${encodeURIComponent(username)}&Passwd=${encodeURIComponent(apiPassword)}`;

	try {
		const response = await this.helpers.httpRequest({
			method: 'GET',
			url,
		});

		const responseText = typeof response === 'string' ? response : JSON.stringify(response);
		const parsed = parseClientLoginResponse(responseText);

		if (!parsed.Auth) {
			throw new Error('Authentication failed: No Auth token in response');
		}

		tokenCache.set(cacheKey, { token: parsed.Auth, timestamp: Date.now() });
		return parsed.Auth;
	} catch (error) {
		// 清除缓存
		tokenCache.delete(cacheKey);
		throw error;
	}
}

/**
 * 清除指定凭证的 Token 缓存
 */
function clearTokenCache(serverUrl: string, username: string): void {
	const cacheKey = `${serverUrl.replace(/\/$/, '')}:${username}`;
	tokenCache.delete(cacheKey);
}

/**
 * 统一的 FreshRSS API 请求函数
 * 自动处理 ClientLogin 认证、Token 过期重试、错误转换
 */
export async function freshrssApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IPollFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject | string,
	query?: IDataObject,
): Promise<unknown> {
	const credentials = await this.getCredentials('freshrssApi');
	const serverUrl = (credentials.serverUrl as string).replace(/\/$/, '');
	const baseUrl = `${serverUrl}/api/greader.php/`;

	let authToken: string;
	try {
		authToken = await getAuthToken.call(this);
	} catch (error) {
		const node = this.getNode();
		throw new NodeApiError(node, { message: (error as Error).message } as JsonObject, {
			message: 'Failed to authenticate with FreshRSS. Please check your credentials.',
		});
	}

	// 构建 URL（含 query 参数）
	let fullUrl = `${baseUrl}${endpoint}`;
	if (query && Object.keys(query).length > 0) {
		const queryString = Object.entries(query)
			.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
			.join('&');
		fullUrl += `?${queryString}`;
	}

	const requestOptions: IHttpRequestOptions = {
		method,
		url: fullUrl,
		headers: {
			Authorization: `GoogleLogin auth=${authToken}`,
		},
	};

	if (body) {
		if (typeof body === 'string') {
			requestOptions.body = body;
			requestOptions.headers = {
				...requestOptions.headers,
				'Content-Type': 'application/x-www-form-urlencoded',
			};
		} else if (method === 'POST') {
			// 对于 POST 请求，使用 form 编码
			requestOptions.headers = {
				...requestOptions.headers,
				'Content-Type': 'application/x-www-form-urlencoded',
			};
			const formBody = Object.entries(body)
				.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
				.join('&');
			requestOptions.body = formBody;
		} else {
			requestOptions.body = body;
		}
	}

	try {
		const response = await this.helpers.httpRequest(requestOptions);
		return response;
	} catch (error) {
		// 如果是 401 错误，清除缓存并重试一次
		const errorObj = error as IDataObject;
		const statusCode = errorObj?.statusCode || errorObj?.httpCode;
		if (statusCode === 401) {
			clearTokenCache(serverUrl, credentials.username as string);
			try {
				const newToken = await getAuthToken.call(this);
				requestOptions.headers = {
					...requestOptions.headers,
					Authorization: `GoogleLogin auth=${newToken}`,
				};
				const retryResponse = await this.helpers.httpRequest(requestOptions);
				return retryResponse;
			} catch (retryError) {
				const node = this.getNode();
				throw new NodeApiError(node, { message: (retryError as Error).message } as JsonObject, {
					message: 'FreshRSS API request failed after re-authentication',
				});
			}
		}

		const node = this.getNode();
		throw new NodeApiError(node, { message: (error as Error).message } as JsonObject);
	}
}

/**
 * 支持分页的 FreshRSS API 请求函数
 * 通过 continuation 参数自动获取所有页面
 */
export async function freshrssApiRequestWithPagination(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IPollFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	query?: IDataObject,
	maxItems?: number,
): Promise<IArticleItem[]> {
	const allItems: IArticleItem[] = [];
	let continuation: string | undefined;
	const pageSize = Math.min(maxItems || 1000, 1000);

	do {
		const currentQuery: IDataObject = {
			...query,
			output: 'json',
			n: pageSize,
		};
		if (continuation) {
			currentQuery.c = continuation;
		}

		const response = (await freshrssApiRequest.call(
			this,
			method,
			endpoint,
			undefined,
			currentQuery,
		)) as IDataObject;

		const items = (response.items as IArticleItem[]) || [];
		allItems.push(...items);

		continuation = response.continuation as string | undefined;

		// 如果设置了最大数量且已达到，停止分页
		if (maxItems && allItems.length >= maxItems) {
			return allItems.slice(0, maxItems);
		}
	} while (continuation);

	return allItems;
}

/**
 * 获取写操作所需的 POST Token
 */
export async function getPostToken(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IPollFunctions,
): Promise<string> {
	const response = await freshrssApiRequest.call(
		this,
		'GET',
		'reader/api/0/token',
	);
	return typeof response === 'string' ? response.trim() : String(response).trim();
}

/**
 * 动态加载分类列表
 */
export async function getCategories(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	try {
		const response = (await freshrssApiRequest.call(
			this,
			'GET',
			'reader/api/0/tag/list',
			undefined,
			{ output: 'json' },
		)) as ITagListResponse;

		const categories: INodePropertyOptions[] = [];
		if (response.tags) {
			for (const tag of response.tags) {
				// 分类的 ID 格式为 user/-/label/CategoryName
				if (tag.id.includes('/label/')) {
					const labelName = tag.id.split('/label/').pop() || tag.id;
					categories.push({
						name: labelName,
						value: tag.id,
					});
				}
			}
		}
		return categories;
	} catch {
		return [{ name: 'Error loading categories', value: '' }];
	}
}

/**
 * 动态加载订阅源列表
 */
export async function getFeeds(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	try {
		const response = (await freshrssApiRequest.call(
			this,
			'GET',
			'reader/api/0/subscription/list',
			undefined,
			{ output: 'json' },
		)) as ISubscriptionListResponse;

		const feeds: INodePropertyOptions[] = [];
		if (response.subscriptions) {
			for (const sub of response.subscriptions) {
				const categoryLabel = sub.categories?.length > 0
					? ` [${sub.categories[0].label}]`
					: '';
				feeds.push({
					name: `${sub.title}${categoryLabel}`,
					value: sub.id,
				});
			}
		}
		return feeds;
	} catch {
		return [{ name: 'Error loading feeds', value: '' }];
	}
}

/**
 * 动态加载用户自定义标签列表
 */
export async function getTags(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	try {
		const response = (await freshrssApiRequest.call(
			this,
			'GET',
			'reader/api/0/tag/list',
			undefined,
			{ output: 'json' },
		)) as ITagListResponse;

		const tags: INodePropertyOptions[] = [];
		if (response.tags) {
			for (const tag of response.tags) {
				// 排除系统状态标签（com.google/...），只保留用户标签
				if (tag.id.includes('/label/')) {
					const labelName = tag.id.split('/label/').pop() || tag.id;
					tags.push({
						name: labelName,
						value: tag.id,
					});
				}
			}
		}
		return tags;
	} catch {
		return [{ name: 'Error loading tags', value: '' }];
	}
}

/**
 * 将 API 返回的文章项格式化为统一的输出格式
 */
export function formatArticle(item: IArticleItem): IFormattedArticle {
	const link = item.alternate?.[0]?.href
		|| item.canonical?.[0]?.href
		|| '';

	const content = item.content?.content || item.summary?.content || '';
	const summary = item.summary?.content || '';

	// 从 categories 中提取标签和状态
	const tags: string[] = [];
	let isRead = false;
	let isStarred = false;

	for (const cat of item.categories || []) {
		if (cat.includes('state/com.google/read')) {
			isRead = true;
		} else if (cat.includes('state/com.google/starred')) {
			isStarred = true;
		} else if (cat.includes('/label/')) {
			const labelName = cat.split('/label/').pop() || cat;
			tags.push(labelName);
		}
	}

	return {
		id: item.id,
		title: item.title || '',
		author: item.author || '',
		content,
		summary,
		published: new Date(item.published * 1000).toISOString(),
		publishedTimestamp: item.published,
		link,
		feedId: item.origin?.streamId || '',
		feedTitle: item.origin?.title || '',
		feedUrl: item.origin?.htmlUrl || '',
		categories: tags,
		tags,
		isRead,
		isStarred,
		crawlTime: item.crawlTimeMsec
			? new Date(parseInt(item.crawlTimeMsec, 10)).toISOString()
			: '',
	};
}
