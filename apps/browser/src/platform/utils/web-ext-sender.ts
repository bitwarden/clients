/**
 * Key under which the browser-authoritative {@link chrome.runtime.MessageSender} is
 * stamped onto an incoming runtime message.
 */
const WEB_EXT_SENDER = Symbol("webExtSender");

/**
 * Records the browser-authoritative sender on a runtime message, mutating `message` in
 * place. Call once, at the message-ingest boundary, with the `sender` argument
 * `chrome.runtime.onMessage` delivers.
 *
 * The stamp is defined non-writable and non-configurable, so in-realm code that recovers
 * the key (via `getOwnPropertySymbols`) cannot overwrite or delete it — a tamper
 * attempt throws. Incoming messages never carry the symbol (serialization strips it), so
 * the definition never collides; calling this twice on the same object throws by design.
 *
 * @returns the same message, for chaining.
 */
export function stampWebExtSender<T extends object>(
  message: T,
  sender: chrome.runtime.MessageSender,
): T {
  Object.defineProperty(message, WEB_EXT_SENDER, {
    configurable: false,
    writable: false,
    enumerable: false,
    value: sender,
  });
  return message;
}

/**
 * Reads the browser-authoritative sender stamped by {@link stampWebExtSender}. Prefer this
 * over any `webExtSender` property on the message body: that property is part of the body
 * and a page can populate it, whereas the value returned here comes from the browser.
 *
 * Returns `undefined` when the value is not a stampable object, or when the message did not
 * cross a context boundary through the ingest that stamps it. Notably, intraprocess
 * (same-context) messages are never stamped. Callers must treat `undefined` as "no trusted
 * provenance" and fail closed rather than assume a default.
 */
export function getWebExtSender(message: unknown): chrome.runtime.MessageSender | undefined {
  if (typeof message !== "object" || message === null) {
    return undefined;
  }

  return (message as Record<symbol, unknown>)[WEB_EXT_SENDER] as
    | chrome.runtime.MessageSender
    | undefined;
}
