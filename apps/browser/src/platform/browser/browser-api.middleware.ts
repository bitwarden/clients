/**
 * Env-paired message handles and dispatch.
 *
 * Defines `NoticeHandle` (fire-and-forget) and `RequestHandle` (request/response)
 * as typed channel objects keyed by `command` and `envPair`. The receiver side —
 * `onMessageFor` / `onMessages` — runs the predicate chain declared for that
 * pair via `passesEnvPair` before invoking the handler.
 *
 * **Where this lives.** This is the background-side machinery: it talks to
 * `chrome.runtime` and `chrome.tabs` directly. Content-script senders use the
 * parallel `handles-content.ts` (Track B) to avoid pulling `BrowserApi` into
 * content bundles.
 */

import { CommandDefinition } from "@bitwarden/common/platform/messaging";
import { LogService } from "@bitwarden/logging";

import { logSecurityEvent } from "../../autofill/security/security-event";
import { type Validator } from "../../autofill/security/validators";
import {
  ENV_PAIR_TAG,
  type EnvPair,
  type EnvPairCheck,
  passesEnvPair,
} from "../messaging/env-pair";

import { BrowserApi } from "./browser-api";

/** Branded shape carried on the wire for every env-paired send. */
type WireMessage<T> = T & { command: string; _envPair: EnvPair };

/**
 * Run the predicate chain declared for `message._envPair`. Thin wrapper around
 * the content-safe `passesEnvPair` that adds optional debug logging — content
 * scripts call `passesEnvPair` directly (no logger).
 */
function passesMiddleware(
  message: { _envPair?: EnvPair } & Record<string, unknown>,
  sender: chrome.runtime.MessageSender,
  logger?: LogService,
): boolean {
  const pair = message?._envPair;
  if (!pair) {
    logger?.warning("[BrowserApi.middleware] Inbound message has no _envPair declared");
    return false;
  }
  if (!passesEnvPair(message, sender)) {
    logger?.warning(`[BrowserApi.middleware] EnvPair check failed for ${pair}`);
    return false;
  }
  return true;
}

/**
 * Base class for env-paired handles. Carries the command + envPair claim and the
 * shared brand symbol that lets receivers identify a handle without an instanceof
 * check (the receiver registry holds these as opaque tokens).
 */
abstract class EnvPairHandle<Req extends Record<string, unknown>> extends CommandDefinition<Req> {
  readonly envPair: EnvPair;
  readonly schema?: Validator<Req>;
  readonly middleware?: EnvPairCheck[];
  readonly logger?: LogService;

  constructor(opts: {
    command: string;
    envPair: EnvPair;
    schema?: Validator<Req>;
    middleware?: EnvPairCheck[];
    logger?: LogService;
  }) {
    super(opts.command);
    this.envPair = opts.envPair;
    this.schema = opts.schema;
    this.middleware = opts.middleware;
    this.logger = opts.logger;
    // Non-enumerable brand so JSON.stringify and for…in don't surface it. The
    // brand is only used as an existence check by `onMessages`.
    Object.defineProperty(this, ENV_PAIR_TAG, { value: true, enumerable: false });
  }

  /** Build the wire-shape payload by attaching the command + envPair claim. */
  protected toWire(req: Req): WireMessage<Req> {
    return { ...req, command: this.command, _envPair: this.envPair } as WireMessage<Req>;
  }
}

/**
 * Fire-and-forget channel. The sender does not wait for a response.
 *
 * Use {@link defineNotice} rather than constructing directly.
 */
export class NoticeHandle<Req extends Record<string, unknown>> extends EnvPairHandle<Req> {
  async send(req: Req): Promise<void> {
    const wire = this.toWire(req);
    await chrome.runtime.sendMessage(wire);
  }

  async notifyTab(
    tabId: number,
    req: Req,
    options?: chrome.tabs.MessageSendOptions,
  ): Promise<void> {
    const wire = this.toWire(req);
    await new Promise<void>((resolve) => {
      chrome.tabs.sendMessage(tabId, wire, options ?? {}, () => {
        // Swallow `chrome.runtime.lastError` — a notice into a tab without a
        // listener (e.g. an extension page) is a normal no-op, not an error.
        void chrome.runtime.lastError;
        resolve();
      });
    });
  }
}

/**
 * Request/response channel. `ask` resolves with the receiver's reply.
 *
 * For tab-targeted asks, the resolved value is `null` if the tab has no content
 * script injected — that is a normal case, not an error.
 *
 * Use {@link defineRequest} rather than constructing directly.
 */
export class RequestHandle<Req extends Record<string, unknown>, Res> extends EnvPairHandle<Req> {
  async ask(req: Req): Promise<Res> {
    const wire = this.toWire(req);
    return chrome.runtime.sendMessage(wire) as Promise<Res>;
  }

  async askTab(
    tabId: number,
    req: Req,
    options?: chrome.tabs.MessageSendOptions,
  ): Promise<Res | null> {
    const wire = this.toWire(req);
    return new Promise<Res | null>((resolve) => {
      chrome.tabs.sendMessage<WireMessage<Req>, Res>(tabId, wire, options ?? {}, (response) => {
        if (chrome.runtime.lastError) {
          // No listener on that tab. Treat as null (normal — not every tab has
          // a content script injected for every command).
          resolve(null);
          return;
        }
        resolve(response);
      });
    });
  }
}

/** Construct a notice handle. */
export function defineNotice<Req extends Record<string, unknown>>(opts: {
  command: string;
  envPair: EnvPair;
  schema?: Validator<Req>;
  middleware?: EnvPairCheck[];
  logger?: LogService;
}): NoticeHandle<Req> {
  return new NoticeHandle<Req>(opts);
}

/** Construct a request handle. */
export function defineRequest<Req extends Record<string, unknown>, Res>(opts: {
  command: string;
  envPair: EnvPair;
  schema?: Validator<Req>;
  middleware?: EnvPairCheck[];
  logger?: LogService;
}): RequestHandle<Req, Res> {
  return new RequestHandle<Req, Res>(opts);
}

type NoticeHandler<Req extends Record<string, unknown>> = (
  req: Req,
  sender: chrome.runtime.MessageSender,
) => void | Promise<void>;

type RequestHandler<Req extends Record<string, unknown>, Res> = (
  req: Req,
  sender: chrome.runtime.MessageSender,
) => Res | Promise<Res>;

/**
 * Register a single notice or request handler. Returns a teardown function that
 * removes the listener.
 */
export function onMessageFor<Req extends Record<string, unknown>>(
  handle: NoticeHandle<Req>,
  handler: NoticeHandler<Req>,
): () => void;
export function onMessageFor<Req extends Record<string, unknown>, Res>(
  handle: RequestHandle<Req, Res>,
  handler: RequestHandler<Req, Res>,
): () => void;
export function onMessageFor<Req extends Record<string, unknown>, Res>(
  handle: NoticeHandle<Req> | RequestHandle<Req, Res>,
  handler: NoticeHandler<Req> | RequestHandler<Req, Res>,
): () => void {
  const listener = (
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ): boolean | undefined => {
    if (message?.command !== handle.command) {
      return undefined;
    }
    if (!passesMiddleware(message, sender, handle.logger)) {
      // Fail closed — return false for notices (no response), respond `null`
      // for requests so the sender's Promise resolves.
      if (handle instanceof RequestHandle) {
        sendResponse(null);
      }
      return false;
    }
    // Schema validation runs between predicates and the handler. A handle with
    // no schema is a Phase 0 channel (warm-up); add one in the migration.
    let parsedReq: Req = message;
    if (handle.schema) {
      const result = handle.schema.parse(message);
      if (!result.ok) {
        logSecurityEvent("schema-parse-failed", { command: handle.command });
        if (handle instanceof RequestHandle) {
          sendResponse(null);
        }
        return false;
      }
      parsedReq = result.value;
    }
    if (handle instanceof NoticeHandle) {
      void (handler as NoticeHandler<Req>)(parsedReq, sender);
      return false;
    }
    // RequestHandle: invoke handler and ship the resolved value back.
    Promise.resolve((handler as RequestHandler<Req, Res>)(parsedReq, sender))
      .then((res) => sendResponse(res))
      .catch(() => sendResponse(null));
    return true; // keep the message channel open for the async response
  };
  BrowserApi.addListener(chrome.runtime.onMessage, listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

/**
 * Register multiple handles + handlers in one listener. Returns a teardown
 * function. Each entry's handle command routes to its handler; messages not
 * matching any registered command are ignored (returned `undefined` so other
 * listeners may handle them).
 */
type Registration =
  | { handle: NoticeHandle<any>; handler: NoticeHandler<any> }
  | { handle: RequestHandle<any, any>; handler: RequestHandler<any, any> };

export function onMessages(registrations: Registration[]): () => void {
  const byCommand = new Map<string, Registration>();
  for (const reg of registrations) {
    if (byCommand.has(reg.handle.command)) {
      throw new Error(
        `onMessages: duplicate command registration "${reg.handle.command}". Each command can have at most one handler.`,
      );
    }
    byCommand.set(reg.handle.command, reg);
  }

  const listener = (
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ): boolean | undefined => {
    const reg = byCommand.get(message?.command);
    if (!reg) {
      return undefined;
    }
    if (!passesMiddleware(message, sender, reg.handle.logger)) {
      if (reg.handle instanceof RequestHandle) {
        sendResponse(null);
      }
      return false;
    }
    let parsedReq: any = message;
    if (reg.handle.schema) {
      const result = reg.handle.schema.parse(message);
      if (!result.ok) {
        logSecurityEvent("schema-parse-failed", { command: reg.handle.command });
        if (reg.handle instanceof RequestHandle) {
          sendResponse(null);
        }
        return false;
      }
      parsedReq = result.value;
    }
    if (reg.handle instanceof NoticeHandle) {
      void (reg.handler as NoticeHandler<any>)(parsedReq, sender);
      return false;
    }
    Promise.resolve((reg.handler as RequestHandler<any, any>)(parsedReq, sender))
      .then((res) => sendResponse(res))
      .catch(() => sendResponse(null));
    return true;
  };
  BrowserApi.addListener(chrome.runtime.onMessage, listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}
