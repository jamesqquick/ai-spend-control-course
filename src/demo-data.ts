const PROMPT = "Reply with OK only.";

export const USER_TYPES = {
	free: {
		label: "Free user",
		prompt: PROMPT,
	},
	pro: {
		label: "Pro user",
		prompt: PROMPT,
	},
	bot: {
		label: "Background bot",
		prompt: PROMPT,
	},
} as const;

export type UserType = keyof typeof USER_TYPES;
