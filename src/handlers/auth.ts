import { createClient, ConnectError } from "@connectrpc/connect";
import { AuthService } from "@yhonda-ohishi-pub-dev/logi-proto";
import type { Env } from "../index";
import { createTransport } from "../lib/transport";
import {
  jsonResponse,
  errorResponse,
  connectErrorToHttpStatus,
} from "../lib/errors";

interface LoginRequestBody {
  username: string;
  password: string;
}

export async function handleAuthLogin(
  request: Request,
  env: Env,
): Promise<Response> {
  let body: LoginRequestBody;
  try {
    body = (await request.json()) as LoginRequestBody;
  } catch {
    return errorResponse(400, "Invalid JSON body");
  }

  if (!body.username || !body.password) {
    return errorResponse(400, "username and password are required");
  }

  const transport = createTransport(env.GRPC_PROXY);
  const client = createClient(AuthService, transport);

  try {
    const response = await client.login({
      username: body.username,
      password: body.password,
    });

    const payloadB64 = response.token.split(".")[1];
    const payload = JSON.parse(atob(payloadB64!));

    return jsonResponse({
      token: response.token,
      expiresAt: response.expiresAt,
      organizationId: payload.org,
    });
  } catch (err) {
    if (err instanceof ConnectError) {
      return errorResponse(connectErrorToHttpStatus(err), err.message);
    }
    throw err;
  }
}
