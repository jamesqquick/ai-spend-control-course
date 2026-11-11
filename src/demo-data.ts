export const PERSONAS = {
	intern: {
		label: "Riley Chen",
		team: "interns",
		role: "Support intern",
		instructions:
			"You are responding as a support intern. Be concise, explain your reasoning plainly, and flag anything that needs an escalation.",
	},
	escalations: {
		label: "Sam Rivera",
		team: "escalations",
		role: "Escalations engineer",
		instructions:
			"You are responding as an escalations engineer. Be precise and technical, and separate confirmed facts from hypotheses.",
	},
} as const;

export const SYSTEM_PROMPT =
	"You are the Fieldstone Support copilot. Help the support team understand customer issues and draft clear, accurate replies. Never invent account details or claim that you changed a customer's account.";

export const PROMPTS = [
	{
		label: "Investigate a 429",
		text: "A customer's order sync started receiving intermittent 429 errors. What should I check first, and what would you tell them?",
	},
	{
		label: "Draft a reply",
		text: "Draft a friendly reply explaining what HTTP 429 means and suggest two steps the customer can take while we investigate.",
	},
	{
		label: "Explain a retry",
		text: "Explain exponential backoff to a customer in two short sentences, without assuming they are a developer.",
	},
] as const;
