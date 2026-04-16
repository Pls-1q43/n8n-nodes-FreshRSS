import {
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import {
	freshrssApiRequest,
	getPostToken,
	getCategories,
	getFeeds,
} from './GenericFunctions';

import {
	subscriptionOperations,
	subscriptionFields,
} from './descriptions/SubscriptionDescription';

import type {
	ISubscriptionListResponse,
	IUnreadCountResponse,
} from './types';

export class FreshrssSubscription implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'FreshRSS Subscription',
		name: 'freshrssSubscription',
		icon: { light: 'file:freshrss.svg', dark: 'file:freshrss.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Manage FreshRSS feed subscriptions',
		defaults: {
			name: 'FreshRSS Subscription',
		},
		usableAsTool: true,
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'freshrssApi', required: true }],
		properties: [
			...subscriptionOperations,
			...subscriptionFields,
		],
	};

	methods = {
		loadOptions: {
			getCategories,
			getFeeds,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;

				if (operation === 'getSubscriptions') {
					// 获取订阅列表
					const response = (await freshrssApiRequest.call(
						this,
						'GET',
						'reader/api/0/subscription/list',
						undefined,
						{ output: 'json' },
					)) as ISubscriptionListResponse;

					const subscriptions = response.subscriptions || [];
					for (const sub of subscriptions) {
						returnData.push({
							json: sub as unknown as IDataObject,
							pairedItem: { item: i },
						});
					}
				} else if (operation === 'addSubscription') {
					// 添加订阅源
					const feedUrl = this.getNodeParameter('feedUrl', i) as string;
					const category = this.getNodeParameter('category', i, '') as string;
					const newCategoryName = this.getNodeParameter('newCategoryName', i, '') as string;

					if (!feedUrl) {
						throw new NodeOperationError(this.getNode(), 'Feed URL is required', { itemIndex: i });
					}

					const token = await getPostToken.call(this);

					const formData: IDataObject = {
						ac: 'subscribe',
						s: `feed/${feedUrl}`,
						T: token,
					};

					// 确定分类
					if (newCategoryName) {
						formData.a = `user/-/label/${newCategoryName}`;
					} else if (category) {
						formData.a = category;
					}

					const response = await freshrssApiRequest.call(
						this,
						'POST',
						'reader/api/0/subscription/edit',
						formData,
					);

					returnData.push({
						json: {
							success: true,
							feedUrl,
							response: typeof response === 'string' ? response : JSON.stringify(response),
						},
						pairedItem: { item: i },
					});
				} else if (operation === 'unsubscribe') {
					// 取消订阅
					const feedId = this.getNodeParameter('feedToUnsubscribe', i) as string;
					const token = await getPostToken.call(this);

					const formData: IDataObject = {
						ac: 'unsubscribe',
						s: feedId,
						T: token,
					};

					const response = await freshrssApiRequest.call(
						this,
						'POST',
						'reader/api/0/subscription/edit',
						formData,
					);

					returnData.push({
						json: {
							success: true,
							feedId,
							response: typeof response === 'string' ? response : JSON.stringify(response),
						},
						pairedItem: { item: i },
					});
				} else if (operation === 'moveToCategory') {
					// 移动到其他分类
					const feedId = this.getNodeParameter('feedToMove', i) as string;
					const targetCategory = this.getNodeParameter('targetCategory', i, '') as string;
					const newTargetCategoryName = this.getNodeParameter('newTargetCategoryName', i, '') as string;
					const token = await getPostToken.call(this);

					const formData: IDataObject = {
						ac: 'edit',
						s: feedId,
						T: token,
					};

					// 确定目标分类
					if (newTargetCategoryName) {
						formData.a = `user/-/label/${newTargetCategoryName}`;
					} else if (targetCategory) {
						formData.a = targetCategory;
					} else {
						throw new NodeOperationError(
							this.getNode(),
							'Target category is required. Select an existing category or enter a new category name.',
							{ itemIndex: i },
						);
					}

					const response = await freshrssApiRequest.call(
						this,
						'POST',
						'reader/api/0/subscription/edit',
						formData,
					);

					returnData.push({
						json: {
							success: true,
							feedId,
							targetCategory: formData.a,
							response: typeof response === 'string' ? response : JSON.stringify(response),
						},
						pairedItem: { item: i },
					});
				} else if (operation === 'getUnreadCount') {
					// 获取未读计数
					const response = (await freshrssApiRequest.call(
						this,
						'GET',
						'reader/api/0/unread-count',
						undefined,
						{ output: 'json' },
					)) as IUnreadCountResponse;

					const unreadCounts = response.unreadcounts || [];
					for (const item of unreadCounts) {
						returnData.push({
							json: item as unknown as IDataObject,
							pairedItem: { item: i },
						});
					}
				} else if (operation === 'exportOpml') {
					// OPML 导出
					const response = await freshrssApiRequest.call(
						this,
						'GET',
						'reader/api/0/subscription/export',
					);

					const opmlContent = typeof response === 'string' ? response : JSON.stringify(response);
					const binaryData = await this.helpers.prepareBinaryData(
						Buffer.from(opmlContent, 'utf-8'),
						'freshrss-subscriptions.opml',
						'application/xml',
					);

					returnData.push({
						json: { success: true },
						binary: { data: binaryData },
						pairedItem: { item: i },
					});
				} else if (operation === 'importOpml') {
					// OPML 导入
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i, 'data') as string;
					const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);

					let opmlContent: string;
					if (binaryData.id) {
						const dataBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
						opmlContent = dataBuffer.toString('utf-8');
					} else {
						opmlContent = Buffer.from(binaryData.data, 'base64').toString('utf-8');
					}

					const token = await getPostToken.call(this);

					const response = await freshrssApiRequest.call(
						this,
						'POST',
						'reader/api/0/subscription/import',
						`T=${encodeURIComponent(token)}&opml=${encodeURIComponent(opmlContent)}`,
					);

					returnData.push({
						json: {
							success: true,
							response: typeof response === 'string' ? response : JSON.stringify(response),
						},
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
				if (error instanceof NodeOperationError) {
					throw error;
				}
				throw new NodeApiError(node, { message: (error as Error).message } as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
