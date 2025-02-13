import crypto from 'node:crypto'
import type { components } from '@octokit/openapi-webhooks-types'
import type { BaseEnableArgs } from '../types'
import { createWebhookProvider } from '../utils'

type schemas = components['schemas']

const allGithubEvents = {
	issue_opened: {
		switch: (event: Record<string, unknown>) => event.action === 'opened',
		parse: async (payload: Record<string, unknown>) => payload as schemas['webhook-issues-opened'],
		event: 'issues'
	},
	issue_closed: {
		switch: (event: Record<string, unknown>) => event.action === 'closed',
		parse: async (payload: Record<string, unknown>) => payload as schemas['webhook-issues-closed'],
		event: 'issues'
	},
	issue_reopened: {
		switch: (event: Record<string, unknown>) => event.action === 'reopened',
		parse: async (payload: Record<string, unknown>) => payload as schemas['webhook-issues-reopened'],
		event: 'issues'
	},
	push: {
		switch: (event: Record<string, unknown>) => 'head_commit' in event,
		parse: async (payload: Record<string, unknown>) => payload as schemas['webhook-push'],
		event: 'push'
	}
}

export function createGithubWebhookProvider<
	T extends readonly (keyof typeof allGithubEvents)[],
	TEnableArgs extends BaseEnableArgs
>({
	webhookSecret,
	events,
	getEnableArgs
}: {
	webhookSecret: string
	events: T
	getEnableArgs: (args: TEnableArgs) => Promise<{
		githubAccessToken: string
		repository: `${string}/${string}`
	}>
}) {
	return createWebhookProvider<
		{
			[K in T[number]]: Awaited<ReturnType<(typeof allGithubEvents)[K]['parse']>>
		},
		TEnableArgs
	>({
		async verify({ request }) {
			const signature = request.headers.get('x-hub-signature-256')
			if (!signature) return false

			const digest = `sha256=${crypto
				.createHmac('sha256', webhookSecret)
				.update(await request.text())
				.digest('hex')}`

			return crypto.timingSafeEqual(
				new Uint8Array(Buffer.from(signature)),
				new Uint8Array(Buffer.from(digest))
			)
		},
		async enable(args: TEnableArgs, { webhookUrl }: { webhookUrl: string }) {
			const { githubAccessToken, repository } = await getEnableArgs(args)

			const response = await fetch(`https://api.github.com/repos/${repository}/hooks`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${githubAccessToken}`
				},
				body: JSON.stringify({
					name: 'web',
					active: true,
					events: [...new Set(events.map(event => allGithubEvents[event].event))],
					config: {
						url: webhookUrl,
						content_type: 'json',
						secret: webhookSecret,
						insecure_ssl: '0'
					}
				})
			})

			if (!response.ok) {
				throw new Error('Failed to enable webhook', { cause: response })
			}
		},
		events: Object.fromEntries(
			events.map(event => [
				event,
				{
					switch: allGithubEvents[event].switch,
					parse: allGithubEvents[event].parse
				}
			])
		) as {
			[K in T[number]]: {
				switch: (event: Record<string, unknown>) => boolean
				parse: (
					input: Record<string, unknown>
				) => Promise<Awaited<ReturnType<(typeof allGithubEvents)[K]['parse']>>>
			}
		}
	})
}
