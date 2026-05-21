export const EXTERNAL_SOURCE_TAG = Symbol("externalSource");

/**
 * @deprecated Phase 2 framework cutover replaces this with classifySender +
 * the env-paired pipeline. Kept for legacy call-site compatibility — do not
 * introduce new callers. See
 * `apps/browser/src/autofill/security/sender.ts#classifySender`.
 */
export const isExternalMessage = (message: Record<PropertyKey, unknown>) => {
  return message?.[EXTERNAL_SOURCE_TAG] === true;
};

/**
 * Symbol key under which chrome-runtime arrivals carry their
 * `chrome.runtime.MessageSender`.
 *
 * Symbol-keyed because plain string properties on the message would survive
 * structured-clone serialization across `chrome.runtime.sendMessage` and could
 * be forged by the sender. Symbols do not survive structured-clone, so this
 * metadata can only be written by the local runtime adapter — that is why
 * predicates must read the sender through `getWebExtSender` rather than from
 * `message._someClaim` (see invariant §2.2 in the implementation plan).
 */
export const WEB_EXT_SENDER = Symbol("webExtSender");

/**
 * Reads the sender that the runtime adapter attached to an inbound message.
 * Returns `undefined` for messages that did not arrive via the chrome-runtime
 * adapter (e.g. intra-process `SubjectMessageSender` traffic).
 *
 * Typed as `unknown` so this library stays free of `chrome.*` types — browser
 * callers cast to `chrome.runtime.MessageSender`. Prefer this accessor over
 * indexing by Symbol directly so every read is grep-able.
 */
export const getWebExtSender = (
  message: Record<PropertyKey, unknown> | null | undefined,
): unknown => {
  if (message == null) {
    return undefined;
  }
  return message[WEB_EXT_SENDER];
};
