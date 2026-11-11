import { env } from "cloudflare:workers";

import { PERSONAS, PROMPTS, SYSTEM_PROMPT } from "./demo-data";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 2_000;

type ChatMessage = {
	role: "user" | "assistant";
	content: string;
};

type ChatRequest = {
	personaId?: string;
	sessionId?: string;
	messages?: ChatMessage[];
};

export default {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/api/config" && request.method === "GET") {
			return Response.json({
				mode: "direct",
				model: MODEL,
				personas: Object.entries(PERSONAS).map(([id, persona]) => ({
					id,
					label: persona.label,
					team: persona.team,
					role: persona.role,
				})),
				prompts: PROMPTS,
			});
		}

		if (url.pathname === "/api/chat" && request.method === "POST") {
			return chat(request);
		}

		return env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler;

async function chat(request: Request): Promise<Response> {
	let body: ChatRequest;
	try {
		body = await request.json<ChatRequest>();
	} catch {
		return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
	}

	const persona = PERSONAS[body.personaId as keyof typeof PERSONAS];
	if (!persona) {
		return Response.json({ error: "Choose a valid support persona." }, { status: 400 });
	}
	if (!/^[a-z0-9-]{8,64}$/.test(body.sessionId ?? "")) {
		return Response.json({ error: "Start a new conversation and try again." }, { status: 400 });
	}

	const messages = normalizeMessages(body.messages);
	if (!messages.length || messages.at(-1)?.role !== "user") {
		return Response.json({ error: "The conversation must end with a user message." }, { status: 400 });
	}

	const startedAt = Date.now();
	try {
		const result = await env.AI.run(MODEL, {
			messages: [
				{ role: "system", content: `${SYSTEM_PROMPT} ${persona.instructions}` },
				...messages,
			],
			max_tokens: 512,
		});
		const responseText =
			typeof result === "string"
				? result
				: typeof result === "object" && result !== null && "response" in result && typeof result.response === "string"
					? result.response
					: undefined;

		if (!responseText) {
			return Response.json({ error: "The model returned an empty response." }, { status: 502 });
		}

		return Response.json({
			message: responseText,
			trace: {
				mode: "direct",
				model: MODEL,
				status: 200,
				durationMs: Date.now() - startedAt,
			},
		});
	} catch (error) {
		return Response.json(
			{
				error: error instanceof Error ? error.message : "The model request failed.",
			},
			{ status: 502 },
		);
	}
}

function normalizeMessages(input: ChatRequest["messages"]): ChatMessage[] {
	if (!Array.isArray(input)) return [];

	return input
		.filter(
			(message) =>
				(message.role === "user" || message.role === "assistant") &&
				typeof message.content === "string" &&
				message.content.trim().length > 0,
		)
		.slice(-MAX_MESSAGES)
		.map((message) => ({
			role: message.role,
			content: message.content.trim().slice(0, MAX_MESSAGE_LENGTH),
		}));
}
