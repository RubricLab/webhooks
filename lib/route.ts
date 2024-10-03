import { type NextRequest, NextResponse } from 'next/server'
import type { WebhookProviders } from './types'

export function webhookHandler({ webhookProviders }: { webhookProviders: WebhookProviders }) {
	return async (
		request: NextRequest,
		{ params }: { params: { provider: keyof WebhookProviders } }
	) => {
		const provider = webhookProviders[params.provider]
		if (!provider) {
			return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
		}

		const payload = await request.text()
		const parsedPayload = JSON.parse(payload)

		try {
			const isValid = await provider.verifyWebhook({
				payload,
				headers: request.headers
			})
			if (!isValid) {
				return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
			}

			const response = await provider.handleWebhook({
				payload: parsedPayload,
				headers: request.headers
			})
			return NextResponse.json(response.body, { status: response.statusCode })
		} catch (error) {
			console.error(`Error in ${provider.provider} webhook:`, error)
			return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
		}
	}
}
