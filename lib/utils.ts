import type { DB, WebhookProviders } from './types'

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
