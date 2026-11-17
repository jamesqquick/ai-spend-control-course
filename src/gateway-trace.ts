import { env } from "cloudflare:workers";

type GatewayTrace = {
  model: string;
  statusCode: number | null;
  metadata: Record<string, string | number | boolean | null | bigint> | null;
  logId: string | null;
  available: boolean;
};

export function getGatewayMode(): "direct" | "gateway" {
  return getGatewayId() ? "gateway" : "direct";
}

export async function getGatewayTrace(fallbackModel: string): Promise<GatewayTrace> {
  const gatewayId = getGatewayId();
  const logId = gatewayId ? env.AI.aiGatewayLogId : null;
  const trace: GatewayTrace = {
    model: fallbackModel,
    statusCode: null,
    metadata: null,
    logId,
    available: false,
  };

  if (!gatewayId || !logId) return trace;

  try {
    const log = await env.AI.gateway(gatewayId).getLog(logId);
    return {
      model: log.model || fallbackModel,
      statusCode: log.status_code,
      metadata: log.metadata ?? null,
      logId,
      available: true,
    };
  } catch {
    return trace;
  }
}

function getGatewayId(): string | undefined {
  const gatewayId = (env as typeof env & { GATEWAY_ID?: string }).GATEWAY_ID;
  return gatewayId || undefined;
}
