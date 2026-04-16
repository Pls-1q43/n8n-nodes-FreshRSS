// FreshRSS Google Reader API 类型定义

/** ClientLogin 认证响应 */
export interface IClientLoginResponse {
	SID: string;
	Auth: string;
}

/** 标签/分类项 */
export interface ITagItem {
	id: string;
	type?: string;
	unread_count?: number;
}

/** 标签列表响应 */
export interface ITagListResponse {
	tags: ITagItem[];
}

/** 订阅源分类信息 */
export interface ISubscriptionCategory {
	id: string;
	label: string;
}

/** 订阅源项 */
export interface ISubscriptionItem {
	id: string;
	title: string;
	url: string;
	htmlUrl: string;
	iconUrl?: string;
	categories: ISubscriptionCategory[];
	firstitemmsec?: string;
}

/** 订阅列表响应 */
export interface ISubscriptionListResponse {
	subscriptions: ISubscriptionItem[];
}

/** 文章来源信息 */
export interface IArticleOrigin {
	streamId: string;
	title: string;
	htmlUrl: string;
}

/** 文章摘要/内容 */
export interface IArticleContent {
	direction: string;
	content: string;
}

/** 文章链接 */
export interface IArticleLink {
	href: string;
	type?: string;
}

/** 文章项 */
export interface IArticleItem {
	id: string;
	crawlTimeMsec: string;
	timestampUsec: string;
	published: number;
	title: string;
	summary?: IArticleContent;
	content?: IArticleContent;
	alternate?: IArticleLink[];
	canonical?: IArticleLink[];
	categories: string[];
	origin: IArticleOrigin;
	author?: string;
	enclosure?: Array<{
		href: string;
		type?: string;
		length?: number;
	}>;
}

/** 文章流响应 */
export interface IStreamContentsResponse {
	direction: string;
	id: string;
	title: string;
	description?: string;
	self?: { href: string };
	updated: number;
	updatedUsec?: string;
	items: IArticleItem[];
	continuation?: string;
}

/** 文章 ID 项 */
export interface IStreamItemId {
	id: string;
	directStreamIds?: string[];
	timestampUsec?: string;
}

/** 文章 ID 列表响应 */
export interface IStreamItemIdsResponse {
	itemRefs: IStreamItemId[];
	continuation?: string;
}

/** 文章内容批量获取响应 */
export interface IItemContentsResponse {
	direction: string;
	id: string;
	title: string;
	updated: number;
	items: IArticleItem[];
}

/** 未读计数项 */
export interface IUnreadCountItem {
	id: string;
	count: number;
	newestItemTimestampUsec: string;
}

/** 未读计数响应 */
export interface IUnreadCountResponse {
	max: number;
	unreadcounts: IUnreadCountItem[];
}

/** 筛选参数（内部使用） */
export interface IFilterParams {
	streamId?: string;
	excludeTarget?: string;
	includeTarget?: string;
	startTime?: number;
	endTime?: number;
	count?: number;
	order?: string;
	continuation?: string;
}

/** 格式化后的文章输出 */
export interface IFormattedArticle {
	id: string;
	title: string;
	author: string;
	content: string;
	summary: string;
	published: string;
	publishedTimestamp: number;
	link: string;
	feedId: string;
	feedTitle: string;
	feedUrl: string;
	categories: string[];
	tags: string[];
	isRead: boolean;
	isStarred: boolean;
	crawlTime: string;
}
