import type { INodeProperties } from 'n8n-workflow';

/**
 * 文章筛选参数的共享定义
 * 被触发器节点和获取器节点共同引用
 */

/** 筛选模式选择 */
const filterModeProperty: INodeProperties = {
	displayName: 'Filter Mode',
	name: 'filterMode',
	type: 'options',
	options: [
		{
			name: 'Simple',
			value: 'simple',
			description: 'Use simple filter with single criteria',
		},
		{
			name: 'Combined',
			value: 'combined',
			description: 'Combine multiple filter criteria with AND/OR logic',
		},
	],
	default: 'simple',
	description: 'Choose how to filter articles',
};

/** 简单模式 - 分类筛选 */
const categoryProperty: INodeProperties = {
	displayName: 'Category Name or ID',
	name: 'category',
	type: 'options',
	typeOptions: {
		loadOptionsMethod: 'getCategories',
	},
	default: '',
	description: 'Filter articles by category. Select "All" to get articles from all categories. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	displayOptions: {
		show: {
			filterMode: ['simple'],
		},
	},
};

/** 简单模式 - 订阅源筛选 */
const feedProperty: INodeProperties = {
	displayName: 'Feed Name or ID',
	name: 'feed',
	type: 'options',
	typeOptions: {
		loadOptionsMethod: 'getFeeds',
	},
	default: '',
	description: 'Filter articles by feed subscription. Select "All" to get articles from all feeds. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	displayOptions: {
		show: {
			filterMode: ['simple'],
		},
	},
};

/** 简单模式 - 标签筛选 */
const tagProperty: INodeProperties = {
	displayName: 'Tag Name or ID',
	name: 'tag',
	type: 'options',
	typeOptions: {
		loadOptionsMethod: 'getTags',
	},
	default: '',
	description: 'Filter articles by custom tag. Select "All" to get articles regardless of tags. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	displayOptions: {
		show: {
			filterMode: ['simple'],
		},
	},
};

/** 简单模式 - 状态筛选 */
const statusProperty: INodeProperties = {
	displayName: 'Status',
	name: 'status',
	type: 'options',
	options: [
		{
			name: 'All',
			value: 'all',
			description: 'All articles regardless of status',
		},
		{
			name: 'Unread',
			value: 'unread',
			description: 'Only unread articles',
		},
		{
			name: 'Read',
			value: 'read',
			description: 'Only read articles',
		},
		{
			name: 'Starred',
			value: 'starred',
			description: 'Only starred articles',
		},
	],
	default: 'all',
	description: 'Filter articles by read/star status',
	displayOptions: {
		show: {
			filterMode: ['simple'],
		},
	},
};

/** 简单模式 - 起始时间 */
const startTimeProperty: INodeProperties = {
	displayName: 'Start Time',
	name: 'startTime',
	type: 'dateTime',
	default: '',
	description: 'Only return articles published after this time',
	displayOptions: {
		show: {
			filterMode: ['simple'],
		},
	},
};

/** 简单模式 - 结束时间 */
const endTimeProperty: INodeProperties = {
	displayName: 'End Time',
	name: 'endTime',
	type: 'dateTime',
	default: '',
	description: 'Only return articles published before this time',
	displayOptions: {
		show: {
			filterMode: ['simple'],
		},
	},
};

/** 组合筛选 - 组合方式 */
const combinationModeProperty: INodeProperties = {
	displayName: 'Combination Mode',
	name: 'combinationMode',
	type: 'options',
	options: [
		{
			name: 'AND',
			value: 'and',
			description: 'Articles must match ALL conditions',
		},
		{
			name: 'OR',
			value: 'or',
			description: 'Articles must match ANY condition',
		},
	],
	default: 'and',
	description: 'How to combine multiple filter conditions',
	displayOptions: {
		show: {
			filterMode: ['combined'],
		},
	},
};

/** 组合筛选 - 筛选条件集合 */
const filterConditionsProperty: INodeProperties = {
	displayName: 'Filter Conditions',
	name: 'filterConditions',
	type: 'fixedCollection',
	typeOptions: {
		multipleValues: true,
	},
	default: {},
	description: 'Define multiple filter conditions',
	displayOptions: {
		show: {
			filterMode: ['combined'],
		},
	},
	options: [
		{
			displayName: 'Conditions',
			name: 'conditions',
			values: [
				{
					displayName: 'Category',
					name: 'category',
					type: 'options',
					default: '',
				},
				{
					displayName: 'End Time',
					name: 'endTime',
					type: 'dateTime',
					default: '',
				},
				{
					displayName: 'Feed',
					name: 'feed',
					type: 'options',
					default: '',
				},
				{
					displayName: 'Filter Type',
					name: 'filterType',
					type: 'options',
					options: [
						{
							name: 'Category',
							value: 'category',
						},
						{
							name: 'Feed',
							value: 'feed',
						},
						{
							name: 'Status',
							value: 'status',
						},
						{
							name: 'Tag',
							value: 'tag',
						},
						{
							name: 'Time Range',
							value: 'timeRange',
						},
					],
					default: 'category',
				},
				{
					displayName: 'Start Time',
					name: 'startTime',
					type: 'dateTime',
					default: '',
				},
				{
					displayName: 'Status',
					name: 'status',
					type: 'options',
					options: [
						{
							name: 'Unread',
							value: 'unread',
						},
						{
							name: 'Read',
							value: 'read',
						},
						{
							name: 'Starred',
							value: 'starred',
						},
						],
					default: 'unread',
				},
				{
					displayName: 'Tag',
					name: 'tag',
					type: 'options',
					default: '',
				},
			],
		},
	],
};

/**
 * 文章筛选参数（供触发器和获取器共用）
 */
export const articleFilterProperties: INodeProperties[] = [
	filterModeProperty,
	categoryProperty,
	feedProperty,
	tagProperty,
	statusProperty,
	startTimeProperty,
	endTimeProperty,
	combinationModeProperty,
	filterConditionsProperty,
];
