/**
 * The server's `message`, decoded from the `ErrorResponseModel` JSON the SDK appends to its
 * transport string, or `undefined` when there is none.
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

/** The decoded {@link apiErrorBodyMessage} of a thrown error, else its raw message, else empty. */
export function serverErrorSentence(e: unknown): string {
  const message = e instanceof Error ? e.message : "";
  return apiErrorBodyMessage(message) ?? message;
}
