import { isUserType, USER_TYPES, type UserType } from "./demo-data";
import { getGatewayMode } from "./gateway-trace";

type ParsedRunRequest =
	| { ok: true; userType: UserType }
	| { ok: false; error: string };

export function getLabConfig(model: string) {
	return {
		mode: getGatewayMode(),
		model,
		userTypes: (Object.keys(USER_TYPES) as UserType[]).map((id) => ({
			id,
			label: USER_TYPES[id].label,
		})),
	};
}

export async function parseRunRequest(request: Request): Promise<ParsedRunRequest> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return { ok: false, error: "Request body must be valid JSON." };
	}

	if (typeof body !== "object" || body === null) {
		return { ok: false, error: "Request body must be a JSON object." };
	}
	const userType = "user_type" in body ? body.user_type : undefined;
	if (!isUserType(userType)) {
		return { ok: false, error: "Choose a valid user type." };
	}

	return { ok: true, userType };
}
