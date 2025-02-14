import { Vercel } from '@vercel/sdk'
import type { Events } from '@vercel/sdk/models/createwebhookop.js'
import type { BaseEnableArgs } from '../types'
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
	webhookSecret,
	events,
	getEnableArgs
}: {
	webhookSecret: string
	events: T
	getEnableArgs: (args: TEnableArgs) => Promise<{
		vercelApiKey: string
		projectId: string
		teamId: string
	}>
}) {
	return createWebhookProvider<
		{
			[K in T[number]]: Awaited<ReturnType<(typeof allVercelEvents)[K]['parse']>>
		},
		TEnableArgs
	>({
		async verify({ request }) {
			return true
		},
		async enable(args: TEnableArgs, { webhookUrl }: { webhookUrl: string }) {
			const { vercelApiKey, projectId, teamId } = await getEnableArgs(args)

			const vercel = new Vercel({
				bearerToken: vercelApiKey
			})

			await vercel.webhooks.createWebhook({
				teamId,
				requestBody: {
					url: webhookUrl,
					events: [...new Set(events.map(event => allVercelEvents[event].event))] as Events[],
					projectIds: [projectId]
				}
			})
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
