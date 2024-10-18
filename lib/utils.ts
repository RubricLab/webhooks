import type { DB, WebhookEvent, WebhookEventMap, WebhookEventType, WebhookProviders } from './types'

export function createWebhookActions({
	webhookProviders,
	db
}: { webhookProviders: WebhookProviders; db: DB }) {
	return {
		async getWebhooksForProvider({
			userId,
			provider,
			accountId
		}: {
			userId: string
			provider: string
			accountId: string
		}) {
			const webhookProvider = webhookProviders[provider]

			if (!webhookProvider) {
				throw new Error(`Webhook provider not found for ${provider}`)
			}

			const webhooks = await db.$transaction(
				Object.keys(webhookProvider.eventHandlers).map(webhookKey =>
					db.webhook.findUnique({
						where: {
							userId_provider_accountId_webhook: {
								userId,
								provider: webhookProvider.provider,
								accountId,
								webhook: webhookKey
							}
						}
					})
				)
			)

			return Object.keys(webhookProvider.eventHandlers).map((webhookKey, index) => {
				const existingWebhook = webhooks[index]
				return (
					existingWebhook || {
						webhook: webhookKey,
						enabled: false,
						config: null,
						provider: webhookProvider.provider,
						accountId,
						userId
					}
				)
			})
		},
		async toggleWebhook({
			provider,
			webhook,
			userId,
			accountId,
			enable
		}: {
			provider: string
			webhook: string

			userId: string
			accountId: string

			enable: boolean
		}) {
			const webhookProvider = webhookProviders[provider]

			if (!webhookProvider) {
				throw new Error(`Webhook provider not found for ${provider}`)
			}

			if (enable) {
				await webhookProvider.enable({ userId, accountId })
			} else {
				await webhookProvider.disable({ userId, accountId })
			}

			await db.webhook.upsert({
				where: {
					userId_provider_accountId_webhook: {
						userId,
						provider: webhookProvider.provider,
						accountId,
						webhook
					}
				},
				create: {
					userId,
					provider: webhookProvider.provider,
					accountId,
					webhook,
					enabled: enable
				},
				update: { enabled: enable }
			})
		}
	}
}

export function createEventDispatcher<
	EventType extends WebhookEventMap,
	Platform extends WebhookEventType
>(type: Platform, eventHandlers: EventType) {
	return {
		async dispatchWebhookEvent<A extends keyof EventType>(
			action: A,
			// @ts-ignore
			data: Parameters<EventType[A]>[0],
			username: string
		): Promise<void> {
			// @ts-ignore
			const event: WebhookEvent<A & string, Parameters<EventType[A]>[0]> = {
				type,
				action: action as A & string,
				data,
				username
			}

			logEvent(event)

			await eventHandlers[action]?.(data, username)
		}
	}
}

export function logEvent<T extends string, D>(event: WebhookEvent<T, D>) {
	const consoleWidth = process.stdout.columns || 80
	const separator = '='.repeat(consoleWidth)
	const userInfo = event.username ? `[${event.username}]` : ''

	console.log(`\x1b[36m${separator}\x1b[0m`)
	console.log(`\x1b[32m${event.type} ${event.action}\x1b[0m \x1b[33m${userInfo}\x1b[0m`)
	console.log(`\x1b[36m${separator}\x1b[0m`)

	console.dir(event.data, { depth: 1, colors: true })

	console.log(`\x1b[36m${separator}\x1b[0m`)
}
