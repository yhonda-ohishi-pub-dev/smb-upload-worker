import { createClient, ConnectError } from "@connectrpc/connect";
import { AuthService } from "@yhonda-ohishi-pub-dev/logi-proto";
import type { Env } from "../index";
import { createTransport } from "../lib/transport";
import {
  jsonResponse,
  errorResponse,
  connectErrorToHttpStatus,
} from "../lib/errors";

interface GoogleAuthRequestBody {
  idToken: string;
}

interface JwkKey {
  kid: string;
  n: string;
  e: string;
  alg: string;
  use: string;
  kty: string;
}

interface GoogleIdTokenPayload {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  exp: number;
  iat: number;
  name?: string;
}

async function fetchGooglePublicKeys(): Promise<JwkKey[]> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!res.ok) throw new Error("Failed to fetch Google public keys");
  const data = (await res.json()) as { keys: JwkKey[] };
  return data.keys;
}

function base64urlToArrayBuffer(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64urlDecode(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64);
}

async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
): Promise<GoogleIdTokenPayload> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const [headerB64, payloadB64, signatureB64] = parts as [
    string,
    string,
    string,
  ];

  const header = JSON.parse(base64urlDecode(headerB64)) as {
    kid: string;
    alg: string;
  };
  const payload = JSON.parse(
    base64urlDecode(payloadB64),
  ) as GoogleIdTokenPayload;

  // 標準クレームを検証
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new Error("Token expired");
  if (payload.aud !== clientId) throw new Error("Invalid audience");
  if (
    payload.iss !== "https://accounts.google.com" &&
    payload.iss !== "accounts.google.com"
  ) {
    throw new Error("Invalid issuer");
  }

  // Google 公開鍵で署名検証
  const keys = await fetchGooglePublicKeys();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("No matching public key found");

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64urlToArrayBuffer(signatureB64);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    signature,
    signingInput,
  );
  if (!valid) throw new Error("Invalid token signature");

  return payload;
}

export async function handleGoogleAuth(
  request: Request,
  env: Env,
): Promise<Response> {
  let body: GoogleAuthRequestBody;
  try {
    body = (await request.json()) as GoogleAuthRequestBody;
  } catch {
    return errorResponse(400, "Invalid JSON body");
  }

  if (!body.idToken) {
    return errorResponse(400, "idToken is required");
  }

  if (!env.GOOGLE_CLIENT_ID) {
    return errorResponse(500, "GOOGLE_CLIENT_ID not configured");
  }

  let payload: GoogleIdTokenPayload;
  try {
    payload = await verifyGoogleIdToken(body.idToken, env.GOOGLE_CLIENT_ID);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Invalid Google ID token";
    console.error(`Google token verification failed: ${reason}`);
    return errorResponse(401, reason);
  }

  const transport = createTransport(env.GRPC_PROXY);
  const client = createClient(AuthService, transport);

  try {
    const response = await client.loginWithGoogle({
      email: payload.email,
    });

    const payloadB64 = response.token.split(".")[1];
    const jwtPayload = JSON.parse(atob(payloadB64!)) as { org: string };

    console.log(`Google login OK: email=${payload.email}`);
    return jsonResponse({
      token: response.token,
      expiresAt: response.expiresAt,
      organizationId: jwtPayload.org,
    });
  } catch (err) {
    if (err instanceof ConnectError) {
      console.error(`Google login failed: email=${payload.email} error=${err.message}`);
      return errorResponse(connectErrorToHttpStatus(err), err.message);
    }
    throw err;
  }
}
