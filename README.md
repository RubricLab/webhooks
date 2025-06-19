# @rubriclab/webhooks

The Webhooks package provides a type-safe framework for defining webhook providers and their events, with built-in support for GitHub, Vercel, and Brex. It includes route handlers designed for Next.js applications and allows developers to easily add custom webhook providers.

It is part of Rubric's architecture for Generative UI when used with:
- [@rubriclab/actions](https://github.com/rubriclab/actions)
- [@rubriclab/blocks](https://github.com/rubriclab/blocks)
- [@rubriclab/chains](https://github.com/rubriclab/chains)
- [@rubriclab/agents](https://github.com/rubriclab/agents)
- [@rubriclab/events](https://github.com/rubriclab/events)

## Get Started

### Installation

`bun add @rubriclab/webhooks`

> @rubriclab scope packages are not built, they are all raw typescript. If using in a next.js app, make sure to transpile.

```ts
// next.config.ts
import type { NextConfig } from 'next'
export default {
	transpilePackages: ['@rubriclab/webhooks'],
	reactStrictMode: true
} satisfies NextConfig
```

> If using inside the monorepo (@rubric), simply add `{"@rubriclab/webhooks": "*"}` to dependencies and then run `bun i`

### Define Webhook Providers

Create webhook providers with type-safe event handling and verification.

```ts
import { createWebhookProvider } from '@rubriclab/webhooks'
import { z } from 'zod'

const customWebhookProvider = createWebhookProvider({
	verify: async ({ request }) => {
		// Verify webhook signature
		const signature = request.headers.get('x-custom-signature')
		return signature === 'valid-signature'
	},
	enable: async (args, { webhookUrl }) => {
		// Enable webhook with external service
		await fetch('https://api.example.com/webhooks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: webhookUrl, ...args })
		})
	},
	events: {
		user_created: {
			switch: (event) => event.type === 'user.created',
			parse: async (payload) => z.object({
				userId: z.string(),
				email: z.string().email()
			}).parse(payload)
		},
		user_updated: {
			switch: (event) => event.type === 'user.updated',
			parse: async (payload) => z.object({
				userId: z.string(),
				changes: z.record(z.unknown())
			}).parse(payload)
		}
	}
})
```

### Configure Webhooks

Set up webhook routes and actions for Next.js with built-in providers.

```ts
// lib/webhooks.ts
import { createWebhooks } from '@rubriclab/webhooks'
import { createGithubWebhookProvider } from '@rubriclab/webhooks'
import { createVercelWebhookProvider } from '@rubriclab/webhooks'
import { createBrexWebhookProvider } from '@rubriclab/webhooks'
import { env } from '~/env'

const githubProvider = createGithubWebhookProvider({
	webhookSecret: env.GITHUB_WEBHOOK_SECRET,
	events: ['push', 'issue_opened'] as const,
	getEnableArgs: async (args) => ({
		githubAccessToken: env.GITHUB_ACCESS_TOKEN,
		repository: args.repository as `${string}/${string}`
	})
})

const vercelProvider = createVercelWebhookProvider({
	webhookSecret: env.VERCEL_WEBHOOK_SECRET,
	events: ['deployment_succeeded'] as const,
	getEnableArgs: async (args) => ({
		vercelToken: env.VERCEL_API_KEY,
		projectId: args.projectId as string
	})
})

const webhookProviders = {
	github: githubProvider,
	vercel: vercelProvider
}

const { routes, actions } = createWebhooks({
	webhookProviders,
	webhookUrl: env.WEBHOOK_BASE_URL,
	eventHandler: async (event) => {
		console.log('Webhook received:', { event })
		
		// Handle different event types
		switch (event.type) {
			case 'github/push':
				await handleGithubPush(event.data)
				break
			case 'github/issue_opened':
				await handleGithubIssueOpened(event.data)
				break
			case 'vercel/deployment_succeeded':
				await handleVercelDeployment(event.data)
				break
		}
	}
})

export { routes, actions }
```

### Enable Webhooks

Use the provided actions to enable webhooks programmatically.

```ts
// app/actions/enable-webhook.ts
'use server'
import { actions } from '~/lib/webhooks'

export const { enableWebhook } = actions
```

### Create Webhook Routes

```ts
// app/api/webhooks/[...webhooks]/route.ts
import { routes } from '~/lib/webhooks'

export const { POST } = routes
```

## Built-in Providers

### GitHub

Handles GitHub webhook events with signature verification and automatic webhook creation.

```ts
import { createGithubWebhookProvider } from '@rubriclab/webhooks'

const githubProvider = createGithubWebhookProvider({
	webhookSecret: env.GITHUB_WEBHOOK_SECRET,
	events: ['push', 'issue_opened', 'issue_closed', 'issue_reopened'] as const,
	getEnableArgs: async (args) => ({
		githubAccessToken: env.GITHUB_ACCESS_TOKEN,
		repository: args.repository as `${string}/${string}`
	})
})
```

**Supported Events:**
- `push` - Repository push events
- `issue_opened` - New issues created
- `issue_closed` - Issues closed
- `issue_reopened` - Issues reopened

### Vercel

Handles Vercel deployment and project events.

```ts
import { createVercelWebhookProvider } from '@rubriclab/webhooks'

const vercelProvider = createVercelWebhookProvider({
	webhookSecret: env.VERCEL_WEBHOOK_SECRET,
	events: ['deployment_succeeded', 'deployment_failed'] as const,
	getEnableArgs: async (args) => ({
		vercelToken: env.VERCEL_API_KEY,
		projectId: args.projectId as string
	})
})
```

**Supported Events:**
- `deployment_succeeded` - Successful deployments
- `deployment_failed` - Failed deployments

### Brex

Handles Brex financial and card events.

```ts
import { createBrexWebhookProvider } from '@rubriclab/webhooks'

const brexProvider = createBrexWebhookProvider({
	webhookSecret: env.BREX_WEBHOOK_SECRET,
	events: ['card_created', 'transaction_created'] as const,
	getEnableArgs: async (args) => ({
		brexApiKey: env.BREX_API_KEY,
		teamId: args.teamId as string
	})
})
```

**Supported Events:**
- `card_created` - New cards created
- `transaction_created` - New transactions

## Custom Providers

Create your own webhook provider by implementing the required interface:

```ts
import { createWebhookProvider } from '@rubriclab/webhooks'
import { z } from 'zod'

const customProvider = createWebhookProvider({
	// Verify webhook authenticity
	verify: async ({ request }) => {
		const signature = request.headers.get('x-signature')
		const body = await request.text()
		return verifySignature(signature, body)
	},
	
	// Enable webhook with external service
	enable: async (args, { webhookUrl }) => {
		await fetch('https://api.example.com/webhooks', {
			method: 'POST',
			headers: { 'Authorization': `Bearer ${args.apiKey}` },
			body: JSON.stringify({ url: webhookUrl })
		})
	},
	
	// Define event types and parsing
	events: {
		user_created: {
			switch: (event) => event.type === 'user.created',
			parse: async (payload) => z.object({
				userId: z.string(),
				email: z.string().email()
			}).parse(payload)
		}
	}
})
```

## Type Safety

The webhooks package provides full TypeScript support with inferred types:

```ts
// Event types are automatically inferred
type WebhookEvent = {
	type: 'github/push' | 'github/issue_opened' | 'vercel/deployment_succeeded'
	data: PushEvent | IssueEvent | DeploymentEvent
}

// Provider-specific enable arguments are type-safe
await actions.enableWebhook({
	provider: 'github',
	args: { repository: 'owner/repo' } // TypeScript ensures correct args
})
```

## Environment Variables

Add the following to your environment schema:

```ts
// env.ts
import { createEnv } from '@t3-oss/env-nextjs'
import z from 'zod'

export default createEnv({
	client: {
		NEXT_PUBLIC_WEBHOOK_URL: z.string().min(1)
	},
	server: {
		GITHUB_WEBHOOK_SECRET: z.string().min(1),
		GITHUB_ACCESS_TOKEN: z.string().min(1),
		VERCEL_WEBHOOK_SECRET: z.string().min(1),
		VERCEL_API_KEY: z.string().min(1),
		BREX_WEBHOOK_SECRET: z.string().min(1),
		BREX_API_KEY: z.string().min(1)
	},
	runtimeEnv: {
		NEXT_PUBLIC_WEBHOOK_URL: process.env.NEXT_PUBLIC_WEBHOOK_URL,
		GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
		GITHUB_ACCESS_TOKEN: process.env.GITHUB_ACCESS_TOKEN,
		VERCEL_WEBHOOK_SECRET: process.env.VERCEL_WEBHOOK_SECRET,
		VERCEL_API_KEY: process.env.VERCEL_API_KEY,
		BREX_WEBHOOK_SECRET: process.env.BREX_WEBHOOK_SECRET,
		BREX_API_KEY: process.env.BREX_API_KEY
	}
})

```
