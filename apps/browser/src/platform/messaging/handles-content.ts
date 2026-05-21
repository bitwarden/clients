/**
 * Content-safe handle factories.
 *
 * Mirror of `browser-api.middleware.ts` for content-script senders. Uses
 * `chrome.runtime.sendMessage` directly because content scripts cannot import
 * `BrowserApi` (see `apps/browser/.claude/rules/autofill-content-scripts.md`).
 *
 * Background handles offer `.notifyTab` / `.askTab`. Content handles
 * intentionally do not — content scripts have no concept of "another tab" to
 * push to. Only the background SW can address a specific tab.
 */

import { CommandDefinition } from "@bitwarden/common/platform/messaging";

import { type Validator } from "../../autofill/security/validators";

import { ENV_PAIR_TAG, type EnvPair, type EnvPairCheck } from "./env-pair";

type WireMessage<T> = T & { command: string; _envPair: EnvPair };

interface LoggerLike {
  warning(message: string): void;
}

/**
 * Base shape for content-script handles. The `schema` slot becomes meaningful
 * once Track B's schema work lands — the receiver runs it between the predicate
 * chain and the handler.
 */
abstract class ContentEnvPairHandle<
  Req extends Record<string, unknown>,
> extends CommandDefinition<Req> {
  readonly envPair: EnvPair;
  readonly schema?: Validator<Req>;
  readonly middleware?: EnvPairCheck[];
  readonly logger?: LoggerLike;

  constructor(opts: {
    command: string;
    envPair: EnvPair;
    schema?: Validator<Req>;
    middleware?: EnvPairCheck[];
    logger?: LoggerLike;
  }) {
    super(opts.command);
    this.envPair = opts.envPair;
    this.schema = opts.schema;
    this.middleware = opts.middleware;
    this.logger = opts.logger;
    Object.defineProperty(this, ENV_PAIR_TAG, { value: true, enumerable: false });
  }

  protected toWire(req: Req): WireMessage<Req> {
    return { ...req, command: this.command, _envPair: this.envPair } as WireMessage<Req>;
  }
}

/** Content-script fire-and-forget channel. */
export class ContentNoticeHandle<
  Req extends Record<string, unknown>,
> extends ContentEnvPairHandle<Req> {
  async send(req: Req): Promise<void> {
    await chrome.runtime.sendMessage(this.toWire(req));
  }
}

/** Content-script request/response channel. */
export class ContentRequestHandle<
  Req extends Record<string, unknown>,
  Res,
> extends ContentEnvPairHandle<Req> {
  async ask(req: Req): Promise<Res> {
    return chrome.runtime.sendMessage(this.toWire(req)) as Promise<Res>;
  }
}

export function defineContentNotice<Req extends Record<string, unknown>>(opts: {
  command: string;
  envPair: EnvPair;
  schema?: Validator<Req>;
  middleware?: EnvPairCheck[];
  logger?: LoggerLike;
}): ContentNoticeHandle<Req> {
  return new ContentNoticeHandle<Req>(opts);
}

export function defineContentRequest<Req extends Record<string, unknown>, Res>(opts: {
  command: string;
  envPair: EnvPair;
  schema?: Validator<Req>;
  middleware?: EnvPairCheck[];
  logger?: LoggerLike;
}): ContentRequestHandle<Req, Res> {
  return new ContentRequestHandle<Req, Res>(opts);
}
