import { CipherType } from "../../vault/enums";

/**
 * PROTOTYPE: agent autofill with approval.
 *
 * JSON messages exchanged between the desktop app and the browser extension over SDK IPC. The
 * extension announces itself with {@link AgentFillTopic.Hello} to `DesktopMain`. The desktop app
 * sends requests to one connected browser (`BrowserBackground`) and the extension answers on
 * {@link AgentFillTopic.Response} with the same `requestId`.
 *
 * The extension accepts requests only when the channel reports the source as `DesktopMain` or
 * `DesktopRenderer`, because the SDK IPC handshake does not authenticate either side.
 */
export const AgentFillTopic = Object.freeze({
  Hello: "agent-fill.hello",
  PrepareFill: "agent-fill.prepare-fill",
  FillItem: "agent-fill.fill-item",
  Response: "agent-fill.response",
} as const);
export type AgentFillTopic = (typeof AgentFillTopic)[keyof typeof AgentFillTopic];

/** Short failure reasons returned to the agent. Never contain vault data. */
export const AgentFillFailureReason = Object.freeze({
  Denied: "denied",
  DeniedWrongAccount: "denied_wrong_account",
  DeniedNotRequested: "denied_not_requested",
  Expired: "expired",
  NoOpenTab: "no_open_tab",
  NoMatchingItem: "no_matching_item",
  FormNotFound: "form_not_found",
  ConnectionKeyInvalid: "connection_key_invalid",
  Locked: "locked",
  BrowserUnreachable: "browser_unreachable",
  NoAllowedBrowser: "no_allowed_browser",
  Busy: "busy",
  Error: "error",
} as const);
export type AgentFillFailureReason =
  (typeof AgentFillFailureReason)[keyof typeof AgentFillFailureReason];

/** Cipher types an agent may fill. */
export type AgentFillCipherType = typeof CipherType.Login | typeof CipherType.Card;

export type AgentFillFailure = {
  requestId: string;
  ok: false;
  reason: AgentFillFailureReason;
  message: string;
};

/** One account logged in to the extension. */
export type AgentFillHelloAccount = {
  userId: string;
  /** The account's "Allow agents to fill in this browser" setting. */
  agentFillAllowed: boolean;
};

/**
 * Sent by the extension to `DesktopMain` when the desktop connection is established or
 * re-established, when the active account changes, on login or logout, and when the agent fill
 * setting changes. The desktop app keeps the latest one per connection.
 */
export type AgentFillHello = {
  /** The extension's own browser name, e.g. "chrome". */
  browser: string;
  extensionVersion: string;
  /** The extension's active account, which is the only one it fills from. */
  activeUserId: string | null;
  accounts: AgentFillHelloAccount[];
};

export type PrepareFillRequest = {
  requestId: string;
  /** The desktop app's active account. The extension serves only its own active account. */
  userId: string;
  /** The URL the agent passed to the tool. Only its origin is used to find tabs. */
  url: string;
};

export type PrepareFillSuccess = {
  requestId: string;
  ok: true;
  tabId: number;
  /** The tab's real hostname, read from the tab rather than the agent's URL. */
  domain: string;
  /** The tab's real URL, used by the desktop app for URI matching. */
  tabUrl: string;
  /** The extension's own browser name, e.g. "chrome". */
  browser: string;
  unlocked: boolean;
};

export type PrepareFillResponse = PrepareFillSuccess | AgentFillFailure;

export type FillItemRequest = {
  requestId: string;
  userId: string;
  tabId: number;
  expectedDomain: string;
  cipherId: string;
  cipherType: AgentFillCipherType;
};

export type FillItemResponse = { requestId: string; ok: true } | AgentFillFailure;

export type AgentFillResponse = PrepareFillResponse | FillItemResponse;
