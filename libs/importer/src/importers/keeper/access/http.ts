export interface HttpResponse {
  status: number;
  data: Uint8Array;
}

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: Uint8Array,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function post(url: string, body: Uint8Array): Promise<HttpResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: body,
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

  throw new HttpError(errorMessage, response.status, data);
}
