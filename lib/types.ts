import type { PrismaClient } from '@prisma/client'

export interface WebhookProvider<T extends WebhookEventMap> {
	provider: string
	enable: ({
		userId,
		accountId
	}: {
		userId: string
		accountId: string
	}) => Promise<void>
	disable: ({
		userId,
		accountId
	}: {
		userId: string
		accountId: string
	}) => Promise<void>
	handleWebhook: ({
		payload,
		headers
	}: {
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		payload: any
		headers: Headers
	}) => Promise<WebhookResponse>
	verifyWebhook: ({
		payload,
		headers
	}: {
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		payload: any
		headers: Headers
	}) => Promise<boolean>
	eventHandlers: T
}

export type WebhookProviders = {
	[provider in string]?: WebhookProvider<WebhookEventMap>
}

export interface WebhookResponse {
	statusCode: number
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	body: any
}

// TODO: remove string type
export type WebhookEventType = keyof WebhookEventMap | string

export interface WebhookEvent<T, D> {
	type: WebhookEventType
	data: D
	username?: string
	action?: T
}

export type WebhookEventHandler<D> = (data: D, username: string) => Promise<void>

export type WebhookEventMap = {
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	[action in string]?: WebhookEventHandler<any>
}

export type DB = PrismaClient
