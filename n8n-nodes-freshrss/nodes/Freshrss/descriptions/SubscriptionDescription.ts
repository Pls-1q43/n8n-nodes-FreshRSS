import type { INodeProperties } from 'n8n-workflow';

/**
 * 订阅操作节点的操作选择和参数定义
 */

/** 操作选择 */
export const subscriptionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Add Subscription',
				value: 'addSubscription',
				description: 'Subscribe to a new feed',
				action: 'Subscribe to a new feed',
			},
			{
				name: 'Export OPML',
				value: 'exportOpml',
				description: 'Export subscriptions as OPML file',
				action: 'Export subscriptions as OPML',
			},
			{
				name: 'Get Subscription List',
				value: 'getSubscriptions',
				description: 'Get all feed subscriptions',
				action: 'Get all feed subscriptions',
			},
			{
				name: 'Get Unread Count',
				value: 'getUnreadCount',
				description: 'Get unread article counts for all feeds and categories',
				action: 'Get unread article counts',
			},
			{
				name: 'Import OPML',
				value: 'importOpml',
				description: 'Import subscriptions from an OPML file',
				action: 'Import subscriptions from OPML',
			},
			{
				name: 'Move to Category',
				value: 'moveToCategory',
				description: 'Move a subscription to a different category',
				action: 'Move a subscription to a different category',
			},
			{
				name: 'Unsubscribe',
				value: 'unsubscribe',
				description: 'Unsubscribe from a feed',
				action: 'Unsubscribe from a feed',
			},
		],
		default: 'getSubscriptions',
	},
];

/** 各操作的参数定义 */
export const subscriptionFields: INodeProperties[] = [
	// ===== 添加订阅源 =====
	{
		displayName: 'Feed URL',
		name: 'feedUrl',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'https://example.com/feed.xml',
		description: 'The URL of the RSS/Atom feed to subscribe to',
		displayOptions: {
			show: {
				operation: ['addSubscription'],
			},
		},
	},
	{
		displayName: 'Category Name or ID',
		name: 'category',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getCategories',
		},
		default: '',
		description: 'The category to add the subscription to (optional). Choose from the list or enter a new category name. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: {
			show: {
				operation: ['addSubscription'],
			},
		},
	},
	{
		displayName: 'New Category Name',
		name: 'newCategoryName',
		type: 'string',
		default: '',
		placeholder: 'My New Category',
		description: 'Enter a new category name if not selecting from existing categories',
		displayOptions: {
			show: {
				operation: ['addSubscription'],
			},
		},
	},

	// ===== 取消订阅 =====
	{
		displayName: 'Feed Name or ID',
		name: 'feedToUnsubscribe',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getFeeds',
		},
		required: true,
		default: '',
		description: 'The feed to unsubscribe from. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: {
			show: {
				operation: ['unsubscribe'],
			},
		},
	},

	// ===== 移动到其他分类 =====
	{
		displayName: 'Feed Name or ID',
		name: 'feedToMove',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getFeeds',
		},
		required: true,
		default: '',
		description: 'The feed to move. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: {
			show: {
				operation: ['moveToCategory'],
			},
		},
	},
	{
		displayName: 'Target Category Name or ID',
		name: 'targetCategory',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getCategories',
		},
		default: '',
		description: 'The target category to move the feed to. Choose from the list or enter a new category name. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: {
			show: {
				operation: ['moveToCategory'],
			},
		},
	},
	{
		displayName: 'New Category Name',
		name: 'newTargetCategoryName',
		type: 'string',
		default: '',
		placeholder: 'My New Category',
		description: 'Enter a new category name if not selecting from existing categories',
		displayOptions: {
			show: {
				operation: ['moveToCategory'],
			},
		},
	},

	// ===== OPML 导入 =====
	{
		displayName: 'Binary Property',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		description: 'Name of the binary property containing the OPML file to import',
		displayOptions: {
			show: {
				operation: ['importOpml'],
			},
		},
	},
];
