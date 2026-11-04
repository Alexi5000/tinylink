export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    signal: options?.signal ?? AbortSignal.timeout(15000),
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "The service could not complete this request. Please try again.";
    const requestId =
      data &&
      typeof data === "object" &&
      "requestId" in data &&
      typeof data.requestId === "string" &&
      /^[a-zA-Z0-9_-]{1,100}$/.test(data.requestId)
        ? data.requestId
        : "";
    throw new Error(requestId ? `${error} Reference: ${requestId}` : error);
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
