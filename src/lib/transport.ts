import { createGrpcWebTransport } from "@connectrpc/connect-web";
import type { Transport } from "@connectrpc/connect";

export function createTransport(grpcProxy: Fetcher): Transport {
  return createGrpcWebTransport({
    baseUrl: "https://cf-grpc-proxy",
    fetch: grpcProxy.fetch.bind(grpcProxy) as typeof globalThis.fetch,
  });
}
