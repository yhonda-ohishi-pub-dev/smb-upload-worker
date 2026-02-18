import { createClient, ConnectError } from "@connectrpc/connect";
import { FilesService } from "@yhonda-ohishi-pub-dev/logi-proto";
import type { Env } from "../index";
import { createTransport } from "../lib/transport";
import { arrayBufferToBase64 } from "../lib/base64";
import {
  jsonResponse,
  errorResponse,
  connectErrorToHttpStatus,
} from "../lib/errors";

export async function handleUpload(
  request: Request,
  env: Env,
): Promise<Response> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(401, "Missing or invalid Authorization header");
  }
  const token = authHeader.slice("Bearer ".length);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(400, "Invalid multipart/form-data body");
  }

  const dataField = formData.get("data");
  if (!dataField || !(dataField instanceof File)) {
    return errorResponse(400, "Missing 'data' file field");
  }

  const arrayBuffer = await dataField.arrayBuffer();
  const base64Content = arrayBufferToBase64(arrayBuffer);
  const filename = dataField.name || "unknown";
  const mimeType = dataField.type || "application/octet-stream";

  const transport = createTransport(env.GRPC_PROXY);
  const client = createClient(FilesService, transport);

  try {
    const response = await client.createFile(
      {
        filename,
        type: mimeType,
        blobBase64: base64Content,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const file = response.file;
    if (!file) {
      return errorResponse(500, "No file in response");
    }

    return jsonResponse({
      uuid: file.uuid,
      message: `Uploaded ${filename}`,
    });
  } catch (err) {
    if (err instanceof ConnectError) {
      return errorResponse(connectErrorToHttpStatus(err), err.message);
    }
    throw err;
  }
}
