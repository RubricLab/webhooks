import { Vercel } from '@vercel/sdk'
import type { Events } from '@vercel/sdk/models/createwebhookop.js'
import type { BaseEnableArgs, BaseEnableResult } from '../types'
import { createWebhookProvider } from '../utils'

const allVercelEvents = {
	deployment_created: {
		switch: (event: Record<string, unknown>) => event.type === 'deployment.created',
		parse: async (payload: Record<string, unknown>) =>
			payload as {
				type: string
				id: string
				createdAt: string
				updatedAt: string
				region: string
				payload: {
					team: {
						id: string | null
					}
					user: {
						id: string
					}
					alias: string[]
					deployment: {
						id: string
						meta: Record<string, unknown>
						url: string
						name: string
					}
					links: {
						deployment: string
						project: string
					}
					target: 'production' | 'staging' | null
					project: {
						id: string
					}
					plan: string
					regions: string[]
				}
			},
		event: 'deployment.created'
	},
	deployment_succeeded: {
		switch: (event: Record<string, unknown>) => event.type === 'deployment.succeeded',
		parse: async (payload: Record<string, unknown>) =>
			payload as {
				type: string
				id: string
				createdAt: string
				updatedAt: string
				region: string
				payload: {
					team: {
						id: string | null
					}
					user: {
						id: string
					}
					alias: string[]
					deployment: {
						id: string
						meta: Record<string, unknown>
						url: string
						name: string
					}
					links: {
						deployment: string
						project: string
					}
					target: 'production' | 'staging' | null
					project: {
						id: string
					}
					plan: string
					regions: string[]
				}
			},
		event: 'deployment.succeeded'
	}
}

export function createVercelWebhookProvider<
	T extends readonly (keyof typeof allVercelEvents)[],
	TEnableArgs extends BaseEnableArgs
>({
	events,
	getEnableArgs,
	onEnable
}: {
	events: T
	getEnableArgs: (args: TEnableArgs) => Promise<{
		vercelApiKey: string
		projectId: string
		teamId: string
	}>
	onEnable: (
		result: Awaited<ReturnType<typeof Vercel.prototype.webhooks.createWebhook>>
	) => Promise<void>
}) {
	return createWebhookProvider<
		{
			[K in T[number]]: Awaited<ReturnType<(typeof allVercelEvents)[K]['parse']>>
		},
		TEnableArgs,
		Awaited<ReturnType<typeof Vercel.prototype.webhooks.createWebhook>>
	>({
		async verify({ request: _request }) {
			return true
		},
		async enable(args: TEnableArgs, { webhookUrl }: { webhookUrl: string }) {
			const { vercelApiKey, projectId, teamId } = await getEnableArgs(args)

			const vercel = new Vercel({
				bearerToken: vercelApiKey
			})

			const wh = await vercel.webhooks.createWebhook({
				teamId,
				requestBody: {
					url: webhookUrl,
					events: [...new Set(events.map(event => allVercelEvents[event].event))] as Events[],
					projectIds: [projectId]
				}
			})
			return wh
		},
		async onEnable(result) {
			await onEnable(result)
		},
		events: Object.fromEntries(
			events.map(event => [
				event,
				{
					switch: allVercelEvents[event].switch,
					parse: allVercelEvents[event].parse
				}
			])
		) as {
			[K in T[number]]: {
				switch: (event: Record<string, unknown>) => boolean
				parse: (
					payload: Record<string, unknown>
				) => Promise<Awaited<ReturnType<(typeof allVercelEvents)[K]['parse']>>>
			}
		}
	})
}
