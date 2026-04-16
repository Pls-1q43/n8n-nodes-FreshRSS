import type { INodeProperties } from 'n8n-workflow';

/**
 * 文章更新操作的参数定义
 * 仅在 FreshRSS 主节点的 Update Article 操作下使用
 */

/** 更新动作选择 */
const updateActionProperty: INodeProperties = {
	displayName: 'Action',
	name: 'updateAction',
	type: 'options',
	options: [
		{
			name: 'Mark as Read',
			value: 'markAsRead',
			description: 'Mark articles as read',
		},
		{
			name: 'Mark as Unread',
			value: 'markAsUnread',
			description: 'Mark articles as unread',
		},
		{
			name: 'Star',
			value: 'star',
			description: 'Add star to articles',
		},
		{
			name: 'Unstar',
			value: 'unstar',
			description: 'Remove star from articles',
		},
		{
			name: 'Add Tag',
			value: 'addTag',
			description: 'Add a custom tag/label to articles',
		},
		{
			name: 'Remove Tag',
			value: 'removeTag',
			description: 'Remove a custom tag/label from articles',
		},
		{
			name: 'Mark All as Read',
			value: 'markAllAsRead',
			description: 'Mark all articles in a feed/category as read',
		},
	],
	default: 'markAsRead',
	description: 'The update action to perform on articles',
	displayOptions: {
		show: {
			operation: ['updateArticle'],
		},
	},
};

/** 文章 ID 输入（除 Mark All as Read 外的所有动作） */
const articleIdsProperty: INodeProperties = {
	displayName: 'Article IDs',
	name: 'articleIds',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'tag:google.com,2005:reader/item/...',
	description: 'The article ID(s) to update. Supports comma-separated multiple IDs or an expression.',
	displayOptions: {
		show: {
			operation: ['updateArticle'],
			updateAction: ['markAsRead', 'markAsUnread', 'star', 'unstar', 'addTag', 'removeTag'],
		},
	},
};

/** 添加标签 - 标签名称 */
const tagNameProperty: INodeProperties = {
	displayName: 'Tag Name',
	name: 'tagName',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'my-tag',
	description: 'The name of the tag/label to add. If the tag does not exist, it will be created automatically.',
	displayOptions: {
		show: {
			operation: ['updateArticle'],
			updateAction: ['addTag'],
		},
	},
};

/** 移除标签 - 标签选择（动态加载） */
const removeTagProperty: INodeProperties = {
	displayName: 'Tag Name or ID',
	name: 'removeTagId',
	type: 'options',
	typeOptions: {
		loadOptionsMethod: 'getTags',
	},
	required: true,
	default: '',
	description: 'The tag/label to remove from articles. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	displayOptions: {
		show: {
			operation: ['updateArticle'],
			updateAction: ['removeTag'],
		},
	},
};

/** 批量标记已读 - 范围选择 */
const markAllAsReadScopeProperty: INodeProperties = {
	displayName: 'Scope',
	name: 'markAllAsReadScope',
	type: 'options',
	options: [
		{
			name: 'All',
			value: 'all',
			description: 'Mark all articles as read',
		},
		{
			name: 'Category',
			value: 'category',
			description: 'Mark all articles in a category as read',
		},
		{
			name: 'Feed',
			value: 'feed',
			description: 'Mark all articles in a feed as read',
		},
	],
	default: 'all',
	description: 'The scope of articles to mark as read',
	displayOptions: {
		show: {
			operation: ['updateArticle'],
			updateAction: ['markAllAsRead'],
		},
	},
};

/** 批量标记已读 - 订阅源选择 */
const markAllFeedProperty: INodeProperties = {
	displayName: 'Feed Name or ID',
	name: 'markAllFeed',
	type: 'options',
	typeOptions: {
		loadOptionsMethod: 'getFeeds',
	},
	required: true,
	default: '',
	description: 'The feed to mark all articles as read. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	displayOptions: {
		show: {
			operation: ['updateArticle'],
			updateAction: ['markAllAsRead'],
			markAllAsReadScope: ['feed'],
		},
	},
};

/** 批量标记已读 - 分类选择 */
const markAllCategoryProperty: INodeProperties = {
	displayName: 'Category Name or ID',
	name: 'markAllCategory',
	type: 'options',
	typeOptions: {
		loadOptionsMethod: 'getCategories',
	},
	required: true,
	default: '',
	description: 'The category to mark all articles as read. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	displayOptions: {
		show: {
			operation: ['updateArticle'],
			updateAction: ['markAllAsRead'],
			markAllAsReadScope: ['category'],
		},
	},
};

/** 批量标记已读 - 截止时间（可选） */
const markAllTimestampProperty: INodeProperties = {
	displayName: 'Before Time',
	name: 'markAllTimestamp',
	type: 'dateTime',
	default: '',
	description: 'Only mark articles published before this time as read. Leave empty to mark all.',
	displayOptions: {
		show: {
			operation: ['updateArticle'],
			updateAction: ['markAllAsRead'],
		},
	},
};

/**
 * 文章更新操作参数（供主节点引用）
 */
export const articleUpdateProperties: INodeProperties[] = [
	updateActionProperty,
	articleIdsProperty,
	tagNameProperty,
	removeTagProperty,
	markAllAsReadScopeProperty,
	markAllFeedProperty,
	markAllCategoryProperty,
	markAllTimestampProperty,
];
