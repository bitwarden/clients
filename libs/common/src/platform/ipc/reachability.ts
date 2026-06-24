import { Endpoint, Source } from "@bitwarden/sdk-internal";

/**
 * Reachability keepalive primitives shared across the platform IPC services.
 *
 * Followers continuously send a lightweight plaintext ping to their leader; the leader replies with
 * a pong. These messages travel over the raw transport (postMessage / native messaging) and are
 * deliberately NOT routed through the SDK crypto (Noise) channel — they exist only to measure
 * liveness. Each client records the timestamp of the last message received from a peer in a
 * {@link ReachabilityTracker}; an endpoint is considered reachable/active when that timestamp is
 * within {@link ACTIVE_WINDOW_MS}.
 */

/** An endpoint is "active"/reachable when the last message from it was within this window. */
export const ACTIVE_WINDOW_MS = 5_000;
/** Ping cadence while the peer is active. Must be < {@link ACTIVE_WINDOW_MS} to sustain activity. */
export const ACTIVE_PING_INTERVAL_MS = 2_000;
/** Back-off ping cadence while the peer is inactive (e.g. not installed / not running). */
export const INACTIVE_PING_INTERVAL_MS = 10_000;

export interface ReachabilityPing {
  type: "bitwarden-reachability-ping";
}

export interface ReachabilityPong {
  type: "bitwarden-reachability-pong";
}

export function isReachabilityPing(message: unknown): message is ReachabilityPing {
  return message != null && (message as ReachabilityPing).type === "bitwarden-reachability-ping";
}

export function isReachabilityPong(message: unknown): message is ReachabilityPong {
  return message != null && (message as ReachabilityPong).type === "bitwarden-reachability-pong";
}

/**
 * Called when an endpoint transitions between active (reachable) and stale (unreachable).
 * `active` is the new state.
 */
export type ReachabilityChangeHandler = (endpoint: Endpoint | Source, active: boolean) => void;

/**
 * Tracks the timestamp of the last message seen from each endpoint and derives activity from it.
 *
 * Call {@link record} on every inbound message (ping, pong, or IPC frame) from a peer. Only inbound
 * traffic proves the peer is present — sends are fire-and-forget and must not be treated as a
 * liveness signal.
 *
 * When `onActiveChange` is provided, it is invoked on each active↔stale transition. Activation is
 * detected immediately on {@link record}; staleness is detected the next time {@link intervalFor} is
 * polled (the ping loops call it every interval), so transitions surface within roughly one ping.
 */
export class ReachabilityTracker {
  private lastMessage = new Map<string, number>();
  private activeState = new Map<string, boolean>();

  constructor(
    private now: () => number = () => Date.now(),
    private onActiveChange?: ReachabilityChangeHandler,
  ) {}

  /** Immediately mark `endpoint` as stale, as if no message was ever received from it. */
  invalidate(endpoint: Endpoint | Source): void {
    this.lastMessage.delete(this.key(endpoint));
    this.emitIfChanged(endpoint, false);
  }

  /** Record that a message was just received from `endpoint`. */
  record(endpoint: Endpoint | Source): void {
    this.lastMessage.set(this.key(endpoint), this.now());
    this.emitIfChanged(endpoint, true);
  }

  /** True when the last message from `endpoint` was within {@link ACTIVE_WINDOW_MS}. */
  isActive(endpoint: Endpoint | Source): boolean {
    const last = this.lastMessage.get(this.key(endpoint));
    return last != null && this.now() - last < ACTIVE_WINDOW_MS;
  }

  /** Adaptive ping cadence for `endpoint`: faster while active, backed off while inactive. */
  intervalFor(endpoint: Endpoint | Source): number {
    const active = this.isActive(endpoint);
    // The ping loops poll this every interval, so this is also where staleness is detected.
    this.emitIfChanged(endpoint, active);
    return active ? ACTIVE_PING_INTERVAL_MS : INACTIVE_PING_INTERVAL_MS;
  }

  private emitIfChanged(endpoint: Endpoint | Source, active: boolean): void {
    const key = this.key(endpoint);
    const previous = this.activeState.get(key) ?? false;
    if (previous !== active) {
      this.activeState.set(key, active);
      this.onActiveChange?.(endpoint, active);
    }
  }

  /**
   * Normalizes an endpoint/source to a stable map key. Desktop main/renderer collapse to a single
   * "Desktop" bucket (they are the same app and reachable together), and web tabs are keyed by tab.
   */
  private key(endpoint: Endpoint | Source): string {
    if (endpoint === "DesktopMain" || endpoint === "DesktopRenderer") {
      return "Desktop";
    }
    if (typeof endpoint === "object" && "BrowserBackground" in endpoint) {
      return "BrowserBackground";
    }
    if (typeof endpoint === "object" && "BrowserForeground" in endpoint) {
      return `BrowserForeground:${endpoint.BrowserForeground.id}`;
    }
    if (typeof endpoint === "object" && "Web" in endpoint) {
      return `Web:${endpoint.Web.tab_id}`;
    }
    return JSON.stringify(endpoint);
  }
}
