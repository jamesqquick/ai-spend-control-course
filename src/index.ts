import { env } from "cloudflare:workers";

import { USER_TYPES } from "./demo-data";
import { getLabConfig, parseRunRequest } from "./lab";
import { createReceiptResponse } from "./receipt";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export default {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/api/config" && request.method === "GET") {
			return Response.json(getLabConfig(MODEL));
		}

		if (url.pathname !== "/api/run" || request.method !== "POST") {
			return env.ASSETS.fetch(request);
		}

		const input = await parseRunRequest(request);
		if (!input.ok) {
			return Response.json({ error: input.error }, { status: 400 });
		}
		const { userType } = input;
		const metadata = {};

		const startedAt = Date.now();
		let response: Response | undefined;
		let errorMessage: string | undefined;
		try {
			const result = await env.AI.run(
				MODEL,
				{
					messages: [{ role: "user", content: USER_TYPES[userType].prompt }],
					max_tokens: 8,
				},
				{
					returnRawResponse: true,
				},
			);
			if (result instanceof Response) response = result;
			else errorMessage = "The model request did not return an HTTP response.";
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : "The model request failed.";
		}

		return createReceiptResponse({
			model: MODEL,
			userType,
			metadata,
			response,
			startedAt,
			errorMessage,
		});
	},
} satisfies ExportedHandler;
