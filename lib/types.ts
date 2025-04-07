export type BaseEventMap = Record<string, unknown>
export type BaseEnableArgs = Record<string, unknown>
export type BaseEnableResult = Record<string, unknown>
export type BaseVerifyArgs = Record<string, unknown>
export type WebhookProvider<
	TEvents extends BaseEventMap,
	TEnableArgs extends BaseEnableArgs,
	TEnableResult extends BaseEnableResult
> = {
	verify: ({ request }: { request: Request }) => Promise<boolean>
	enable: (args: TEnableArgs, { webhookUrl }: { webhookUrl: string }) => Promise<TEnableResult>
	onEnable: (result: TEnableResult) => Promise<void>
	events: {
		[K in keyof TEvents]: {
			switch: (event: Record<string, unknown>) => boolean
			parse: (input: Record<string, unknown>) => Promise<TEvents[K]>
		}
	}
}

export type WebhookEvent<
	TProviders extends Record<string, WebhookProvider<BaseEventMap, BaseEnableArgs, BaseEnableResult>>
> = {
	[P in keyof TProviders]: {
		[E in keyof TProviders[P]['events']]: {
			type: `${P & string}/${E & string}`
			data: Awaited<ReturnType<TProviders[P]['events'][E]['parse']>>
		}
	}[keyof TProviders[P]['events']]
}[keyof TProviders]

export type GithubWebhookEnableArgs = {
	githubAccountId: string
	repository: string
}

export type WebhookActions<
	TProviders extends Record<string, WebhookProvider<BaseEventMap, BaseEnableArgs, BaseEnableResult>>
> = {
	enableWebhook: <TProvider extends keyof TProviders>(args: {
		provider: TProvider
		args: TProviders[TProvider] extends WebhookProvider<
			BaseEventMap,
			infer TEnableArgs,
			infer TEnableResult
		>
			? TEnableArgs
			: never
	}) => Promise<
		TProviders[TProvider] extends WebhookProvider<
			BaseEventMap,
			infer TEnableArgs,
			infer TEnableResult
		>
			? TEnableResult
			: never
	>
}
