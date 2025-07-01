import crypto from 'node:crypto'
import type { components } from '@octokit/openapi-webhooks-types'
import { Octokit } from 'octokit'
import type { BaseEnableArgs } from '../types'
import { createWebhookProvider } from '../utils'

type schemas = components['schemas']

const allGithubEvents = {
	issue_closed: {
		event: 'issues',
		parse: async (payload: Record<string, unknown>) => payload as schemas['webhook-issues-closed'],
		switch: (event: Record<string, unknown>) => event.action === 'closed'
	},
	issue_opened: {
		event: 'issues',
		parse: async (payload: Record<string, unknown>) => payload as schemas['webhook-issues-opened'],
		switch: (event: Record<string, unknown>) => event.action === 'opened'
	},
	issue_reopened: {
		event: 'issues',
		parse: async (payload: Record<string, unknown>) => payload as schemas['webhook-issues-reopened'],
		switch: (event: Record<string, unknown>) => event.action === 'reopened'
	},
	push: {
		event: 'push',
		parse: async (payload: Record<string, unknown>) => payload as schemas['webhook-push'],
		switch: (event: Record<string, unknown>) => 'head_commit' in event
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
		async enable(args: TEnableArgs, { webhookUrl }: { webhookUrl: string }) {
			const { githubAccessToken, repository } = await getEnableArgs(args)

			const octokit = new Octokit({ auth: githubAccessToken })

			await octokit.rest.repos.createWebhook({
				active: true,
				config: {
					content_type: 'json',
					insecure_ssl: '0',
					secret: webhookSecret,
					url: webhookUrl
				},
				events: [...new Set(events.map(event => allGithubEvents[event].event))],
				name: 'web',
				owner: repository.split('/')[0] as string,
				repo: repository.split('/')[1] as string
			})
		},
		events: Object.fromEntries(
			events.map(event => [
				event,
				{
					parse: allGithubEvents[event].parse,
					switch: allGithubEvents[event].switch
				}
			])
		) as {
			[K in T[number]]: {
				switch: (event: Record<string, unknown>) => boolean
				parse: (
					input: Record<string, unknown>
				) => Promise<Awaited<ReturnType<(typeof allGithubEvents)[K]['parse']>>>
			}
		},
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
		}
	})
}
