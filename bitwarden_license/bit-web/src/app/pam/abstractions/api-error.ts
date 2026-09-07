/**
 * The server's `message` field, decoded out of the `ErrorResponseModel` JSON the SDK
 * concatenated onto its transport string, or `undefined` when the message isn't that shape.
 *
 * Every PAM error type carries the same `Api` variant, stringifying the whole failed response as
 * `error in response: status code 400 Bad Request: {…}`; the slice is bounded at both ends, so
 * trailing transport text doesn't defeat the parse.
 *
 * Callers own what a miss means: some fall back to a generic message, others re-read the raw
 * string.
 */
export function apiErrorBodyMessage(message: string): string | undefined {
  const bodyStart = message.indexOf("{");
  const bodyEnd = message.lastIndexOf("}");
  if (bodyStart === -1 || bodyEnd <= bodyStart) {
    return undefined;
  }
  try {
    const body: unknown = JSON.parse(message.slice(bodyStart, bodyEnd + 1));
    const serverMessage = (body as { message?: unknown }).message;
    return typeof serverMessage === "string" && serverMessage.length > 0
      ? serverMessage
      : undefined;
  } catch {
    return undefined;
  }
}

/** The server sentence behind a thrown SDK error: the decoded {@link apiErrorBodyMessage}, else the raw message, else empty — the prologue every error catalog opens with. */
export function serverErrorSentence(e: unknown): string {
  const message = e instanceof Error ? e.message : "";
  return apiErrorBodyMessage(message) ?? message;
}
