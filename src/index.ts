import { handleAuthLogin } from "./handlers/auth";
import { handleUpload } from "./handlers/upload";

export interface Env {
  GRPC_PROXY: Fetcher;
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "POST") {
      return errorResponse(405, "Method not allowed");
    }

    try {
      switch (url.pathname) {
        case "/auth/login":
          return await handleAuthLogin(request, env);
        case "/upload":
          return await handleUpload(request, env);
        default:
          return errorResponse(404, "Not found");
      }
    } catch (err) {
      console.error("Unhandled error:", err);
      return errorResponse(
        500,
        err instanceof Error ? err.message : "Internal server error",
      );
    }
  },
};
