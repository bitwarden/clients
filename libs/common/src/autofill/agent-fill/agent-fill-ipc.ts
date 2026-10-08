import { CipherType } from "../../vault/enums";

/**
 * JSON messages exchanged between the desktop app and the browser extension over SDK IPC, as
 * defined by the AI-137 agent fill contract. No message carries a password, TOTP code or seed, card
 * number, or security code.
 *
 * The extension announces itself with {@link AgentFillTopic.Hello} to `DesktopMain`. The desktop app
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
  RequestClosed: "agent-fill.request-closed",
  Response: "agent-fill.response",
} as const);
export type AgentFillTopic = (typeof AgentFillTopic)[keyof typeof AgentFillTopic];

/** Short failure reasons returned to the agent. Never contain vault data. */
export const AgentFillFailureReason = Object.freeze({
  // User-facing reasons
  Denied: "denied",
  DeniedWrongAccount: "denied_wrong_account",
  DeniedNotRequested: "denied_not_requested",
  Expired: "expired",
  NoOpenTab: "no_open_tab",
  NoMatchingItem: "no_matching_item",
  WrongSite: "wrong_site",
  FormNotFound: "form_not_found",
  ConnectionPaused: "connection_paused",
  // Operational reasons: they tell the agent what the user has to fix
  Locked: "locked",
  ConnectionKeyInvalid: "connection_key_invalid",
  DesktopUnreachable: "desktop_unreachable",
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
  /** Local to one fill call and the same from prepare to fill. Drives the popup banner. */
  approvalId: string;
  /** The desktop app's active account. The extension serves only its own active account. */
  userId: string;
  /** The URL the agent passed to the tool. Only its origin is used to find tabs. */
  url: string;
  /** The connection's name, shown in the popup's pending-request banner. */
  connectionName: string;
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
  approvalId: string;
  userId: string;
  tabId: number;
  /** The domain shown in the approval dialog. */
  expectedDomain: string;
  cipherId: string;
  cipherType: AgentFillCipherType;
};

export type FillItemResponse = { requestId: string; ok: true } | AgentFillFailure;

/**
 * Sent when an approval ends without a fill (denied, expired or cancelled), so the extension can
 * clear the popup banner. Has no response.
 */
export type RequestClosedMessage = { approvalId: string };

export type AgentFillResponse = PrepareFillResponse | FillItemResponse;
