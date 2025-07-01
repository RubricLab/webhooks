import type { BaseEnableArgs } from '../types'
import { createWebhookProvider } from '../utils'

const allBrexEvents = {
	expense_payment_updated: {
		event: 'EXPENSE_PAYMENT_UPDATED',
		parse: async (payload: Record<string, unknown>) =>
			payload as {
				event_type: 'EXPENSE_PAYMENT_UPDATED'
				expense_id: string
				payment_status: 'PENDING' | 'DECLINED'
				payment_status_reason:
					| 'OTHER'
					| 'APPROVED'
					| 'EXCEEDED_BUDGET_LIMIT'
					| 'BUDGET_EXPIRED'
					| 'NO_BUDGET'
					| 'BUDGET_NOT_YET_STARTED'
					| 'BUDGET_CATEGORY_RESTRICTION'
					| 'BUDGET_MERCHANT_RESTRICTION'
					| 'SUSPECTED_FRAUD'
					| 'EXCEEDED_GLOBAL_LIMIT'
					| 'EXCEEDED_USER_LIMIT'
					| 'EXCEEDED_CARD_LIMIT'
					| 'INVALID_EXPIRATION_DATE'
					| 'CARD_NOT_ACTIVE'
					| 'INVALID_CARD_CREDENTIALS'
					| 'INVALID_BILLING_ADDRESS'
					| 'CARD_SUSPENDED'
					| 'CARD_TERMINATED'
					| 'CARD_EXPIRED'
					| 'MCC_BLOCKED'
					| 'USER_SUSPENDED'
					| 'INVALID_PIN'
					| 'INVALID_CVV'
					| 'EXCEEDED_PIN_ATTEMPTS'
					| 'INSIDE_SANCTIONED_COUNTRY'
					| 'SOFT_EXPIRATION'
					| 'TRANSFERRED_CARD_NEW_MERCHANT'
					| 'EXCEEDED_ANCESTOR_BUDGET_LIMIT'
					| 'EXCEEDED_BUDGET_TRANSACTION_LIMIT'
					| 'TOS_BLOCKED'
					| 'COMPLIANCE_BLOCKED'
				payment_type: 'PURCHASE' | 'REFUND' | 'WITHDRAWAL' | 'DECLINED'
				company_id?: string
				purchased_at: string
				original_amount: {
					amount: number
					currency: string | null
				} | null
				billing_amount: {
					amount: number
					currency: string | null
				} | null
				card_id: string
				merchant: {
					raw_descriptor: string
					mcc: string
					country: string
				} | null
				payment_authorization_code: string
			},
		switch: (event: Record<string, unknown>) => event.event_type === 'EXPENSE_PAYMENT_UPDATED'
	}
}

export function createBrexWebhookProvider<
	T extends readonly (keyof typeof allBrexEvents)[],
	TEnableArgs extends BaseEnableArgs
>({
	webhookSecret,
	events,
	getEnableArgs
}: {
	webhookSecret: string
	events: T
	getEnableArgs: (args: TEnableArgs) => Promise<{
		brexApiKey: string
	}>
}) {
	return createWebhookProvider<
		{
			[K in T[number]]: Awaited<ReturnType<(typeof allBrexEvents)[K]['parse']>>
		},
		TEnableArgs
	>({
		async enable(args: TEnableArgs, { webhookUrl }: { webhookUrl: string }) {
			const { brexApiKey } = await getEnableArgs(args)

			const response = await fetch('https://platform.brexapis.com/v1/webhooks', {
				body: JSON.stringify({
					event_types: [...new Set(events.map(event => allBrexEvents[event].event))],
					url: webhookUrl
				}),
				headers: {
					Authorization: `Bearer ${brexApiKey}`,
					'Content-Type': 'application/json',
					'Idempotency-Key': webhookSecret
				},
				method: 'POST'
			})

			if (!response.ok) {
				throw new Error(`Failed to create Brex webhook: ${await response.text()}`)
			}
		},
		events: Object.fromEntries(
			events.map(event => [
				event,
				{
					parse: allBrexEvents[event].parse,
					switch: allBrexEvents[event].switch
				}
			])
		) as {
			[K in T[number]]: {
				switch: (event: Record<string, unknown>) => boolean
				parse: (
					payload: Record<string, unknown>
				) => Promise<Awaited<ReturnType<(typeof allBrexEvents)[K]['parse']>>>
			}
		},
		async verify({ request: _request }) {
			return true // TODO: Add verification
		}
	})
}
