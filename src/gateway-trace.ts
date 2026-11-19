import { env } from "cloudflare:workers";

export function getGatewayMode(): "direct" | "gateway" {
	return getGatewayId() ? "gateway" : "direct";
}

function getGatewayId(): string | undefined {
	const gatewayId = (env as typeof env & { GATEWAY_ID?: string }).GATEWAY_ID;
	return gatewayId || undefined;
}
