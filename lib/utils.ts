import type {
	BaseEnableArgs,
	BaseEventMap,
	WebhookActions,
	WebhookEvent,
	WebhookProvider
} from './types'

export function createWebhookProvider<
	TEvents extends BaseEventMap,
	TEnableArgs extends BaseEnableArgs
>({
	verify,
	enable,
	events
}: {
	verify: ({ request }: { request: Request }) => Promise<boolean>
	enable: (args: TEnableArgs, { webhookUrl }: { webhookUrl: string }) => Promise<void>
	events: {
		[K in keyof TEvents]: {
			switch: (event: Record<string, unknown>) => boolean
			parse: (input: Record<string, unknown>) => Promise<TEvents[K]>
		}
	}
}) {
	return {
		enable,
		events,
		verify
	}
}

export function createWebhooks<
	// biome-ignore lint/suspicious/noExplicitAny: not sure how to fix this
	WebhookProviders extends Record<string, WebhookProvider<BaseEventMap, any>>
>({
	webhookProviders,
	eventHandler,
	webhookUrl
}: {
	webhookProviders: WebhookProviders
	eventHandler: (event: WebhookEvent<WebhookProviders>) => Promise<void>
	webhookUrl: string
}): {
	routes: {
		POST: (
			request: Request,
			{
				params
			}: {
				params: Promise<{
					webhooks: [provider: keyof WebhookProviders]
				}>
			}
		) => Promise<Response>
	}
	actions: WebhookActions<WebhookProviders>
} {
	return {
		actions: {
			enableWebhook: async ({ provider, args }) => {
				const webhookProvider = webhookProviders[provider]
				if (!webhookProvider) {
					throw new Error(`Provider ${String(provider)} not found`)
				}
				return webhookProvider.enable(args, {
					webhookUrl: `${webhookUrl}/webhooks/${String(provider)}`
				})
			}
		},
		routes: {
			async POST(
				request: Request,
				{
					params
				}: {
					params: Promise<{
						webhooks: [provider: keyof WebhookProviders]
					}>
				}
			) {
				const {
					webhooks: [provider]
				} = await params

				let webhookProvider: WebhookProviders[keyof WebhookProviders] | undefined

				if (webhookProviders && provider in webhookProviders) {
					webhookProvider = webhookProviders[provider as keyof WebhookProviders]
				}

				if (!webhookProvider) {
					return new Response('Webhook provider not found', { status: 404 })
				}

				const isValid = await webhookProvider.verify({
					request: request.clone()
				})

				if (!isValid) {
					return new Response('Invalid webhook', { status: 400 })
				}

				const payload = await request.json()

				const event = Object.keys(webhookProvider.events).find(event =>
					webhookProvider.events[event]?.switch(payload)
				)

				if (!event) {
					console.error('Webhook event not found')
					return new Response('Webhook event not found', { status: 400 })
				}

				await eventHandler({
					data: payload,
					type: `${String(provider)}/${String(event)}`
				})

				return new Response(`Thank you for your webhook ${String(provider)}!`, {
					status: 200
				})
			}
		}
	}
}
