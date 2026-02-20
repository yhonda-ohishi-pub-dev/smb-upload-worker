import { createClient, ConnectError } from "@connectrpc/connect";
import { OrganizationService } from "@yhonda-ohishi-pub-dev/logi-proto";
import type { Env } from "../index";
import { createTransport } from "../lib/transport";
import {
  jsonResponse,
  errorResponse,
  connectErrorToHttpStatus,
} from "../lib/errors";

export async function handleListOrganizations(
  request: Request,
  env: Env,
): Promise<Response> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(401, "Missing or invalid Authorization header");
  }
  const token = authHeader.slice("Bearer ".length);

  const transport = createTransport(env.GRPC_PROXY);
  const client = createClient(OrganizationService, transport);

  try {
    const response = await client.listMyOrganizations(
      {},
      {
        headers: {
          "x-auth-token": token,
        },
      },
    );

    return jsonResponse({
      organizations: response.organizations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: org.role,
      })),
    });
  } catch (err) {
    if (err instanceof ConnectError) {
      return errorResponse(connectErrorToHttpStatus(err), err.message);
    }
    throw err;
  }
}
