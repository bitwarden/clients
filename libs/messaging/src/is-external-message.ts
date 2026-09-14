/**
 * Key under which a message is stamped as having entered the application from another context.
 */
const EXTERNAL_SOURCE_TAG = Symbol("externalSource");

/**
 * Stamps a message as having arrived from another context, mutating `message` in place. Call
 * once, at the message-ingest boundary, before the message is observable by any consumer.
 *
 * The parameter is limited to records because only messages are stamped, and a message is
 * always a record.
 *
 * @param message - The ingested message to stamp. Throws when frozen, sealed, or nullish.
 * @returns the same message, for chaining.
 */
export function stampAsExternal<T extends Record<PropertyKey, unknown>>(message: T): T {
  Object.defineProperty(message, EXTERNAL_SOURCE_TAG, {
    configurable: false,
    writable: false,
    // enumerable so the stamp survives `{ ...message }`
    enumerable: true,
    value: true,
  });

  return message;
}

/**
 * Reads whether a message entered the application from another context, as stamped by
 * {@link stampAsExternal}.
 *
 * Returns `false` for anything that is not a stamped record, including messages that never
 * crossed a context boundary. Intraprocess messages are never stamped, so `false` means "not
 * known to be external".
 *
 * WARNING: The absence of a stamp does not mean "known to be internal". Treat the absence of
 * a stamp as you would an unlabelled message. It is not evidence of trustworthiness.
 *
 * A `true` result narrows an unknown value to a record, since {@link stampAsExternal} stamps
 * only records.
 */
export const isExternalMessage = (message: unknown): message is Record<PropertyKey, unknown> => {
  if (typeof message !== "object" || message === null || Array.isArray(message)) {
    return false;
  }

  return (message as Record<PropertyKey, unknown>)[EXTERNAL_SOURCE_TAG] === true;
};
