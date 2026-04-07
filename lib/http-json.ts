export type JsonLikePayload = {
  ok?: boolean;
  error?: string;
  message?: string;
  details?: unknown;
  [key: string]: unknown;
};

export async function safeReadJsonResponse(response: Response): Promise<JsonLikePayload> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const text = await response.text();
    return { ok: response.ok, message: text || `Request failed with status ${response.status}` };
  }

  try {
    return await response.json();
  } catch {
    return { ok: response.ok, message: `Request failed with status ${response.status}` };
  }
}
