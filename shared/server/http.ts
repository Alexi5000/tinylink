export const MAX_JSON_BYTES = 16 * 1024;

export class ApiError extends Error {
  readonly status: number;
  readonly headers: Record<string, string>;

  constructor(
    status: number,
    message: string,
    headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.headers = headers;
  }
}

const responseHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: { ...responseHeaders, ...headers },
  });
}

export function text(message: string, status: number) {
  return new Response(message, { status, headers: responseHeaders });
}

export function requireMethod(method: string, allowed: readonly string[]) {
  if (!allowed.includes(method)) {
    throw new ApiError(405, "Method not allowed.", {
      Allow: allowed.join(", "),
    });
  }
}

export function jsonObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "Send a valid JSON object.");
  }
  return value as Record<string, unknown>;
}

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > MAX_JSON_BYTES) {
    await request.body?.cancel();
    throw new ApiError(413, "Request body must not exceed 16 KiB.");
  }
  if (!request.body) throw new ApiError(400, "Send a valid JSON object.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_JSON_BYTES) {
        await reader.cancel();
        throw new ApiError(413, "Request body must not exceed 16 KiB.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return jsonObject(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
  } catch {
    throw new ApiError(400, "Send a valid JSON object.");
  }
}

export function decodeCode(encoded: string): string {
  try {
    const code = decodeURIComponent(encoded);
    if (!code || code.length > 40 || /[\s/\\\u0000-\u001f\u007f]/.test(code)) {
      throw new Error("Invalid code");
    }
    return code;
  } catch {
    throw new ApiError(400, "Invalid short-link code.");
  }
}
