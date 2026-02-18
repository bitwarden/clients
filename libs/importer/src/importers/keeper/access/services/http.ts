import { HttpResponse } from "../models";

export async function post(url: string, body: Uint8Array): Promise<HttpResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body,
  });

  const data = new Uint8Array(await response.arrayBuffer());

  if (response.ok) {
    return {
      status: response.status,
      data,
    };
  }

  let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
  if (data.length > 0) {
    try {
      const text = new TextDecoder().decode(data);
      errorMessage += ` - ${text}`;
    } catch {
      // Ignore decode errors
    }
  }

  throw new Error(errorMessage);
}
