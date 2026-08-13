import { nodeIsElement } from "../utils";

import { DomQueryService } from "./abstractions/dom-query.service";

/** A wall-clock deadline or reading; durations stay plain `number`. */
type EpochMs = number;

/**
 * `attachShadow()` emits no mutation record, so a custom-element host observed once and never
 * revisited is a field we silently fail to autofill. Both waits below are deadline-bounded, so a
 * host that never hydrates expires instead of keeping the retry timer armed:
 *
 *   parked (not `:defined`) --`:defined`--> awaiting shadow root --attachShadow--> enrolled, dropped
 */
export class ShadowHostHydrationTracker {
  private hostsAwaitingShadowRoot: Map<Element, EpochMs> = new Map();
  // Tombstones, keyed by identity: an expired host must not be re-admitted by a later scan.
  private expiredHosts = new WeakSet<Element>();
  // Rotates FIFO when the tracking map is full — delay, not starvation.
  private overflowQueue: Element[] = [];
  private hostsAwaitingDefinition: Map<Element, EpochMs> = new Map();

  private pendingMutationAddedElements: Set<Element> = new Set();
  private pendingMutationAddedElementsOverflowed = false;

  private retryTimeout: NodeJS.Timeout | number | null = null;
  private retryRound = 0;
  private scanTimeout: NodeJS.Timeout | number | null = null;
  private pendingScan = false;

  // Deadlines, not scan counts: coverage stays independent of page churn.
  private readonly hostLifetimeMs = 30000;
  // Longer than a hydration wait so a slow-loading definition still upgrades, but finite.
  private readonly awaitingDefinitionLifetimeMs = 60000;
  private readonly retryCapMs = 8000;
  private readonly trackingCap = 64;
  private readonly overflowCap = 192;
  private readonly awaitingDefinitionCap = 64;
  private readonly pendingMutationAddedElementsCap = 256;
  // Also the base delay for retry backoff.
  private readonly scanDebounceMs = 500;

  /**
   * @param mutationObserver handed to each scan so discovered roots are enrolled where they are
   *   found, rather than waiting for the next whole-document walk
   * @param requestPageDetailsUpdate invoked when a scan finds a root that earlier collection
   *   missed; the caller debounces it into a re-collection
   * @param now injectable clock, so specs can advance deadlines without faking timers
   */
  constructor(
    private readonly domQueryService: DomQueryService,
    private readonly mutationObserver: MutationObserver,
    private readonly requestPageDetailsUpdate: () => void,
    private readonly now: () => EpochMs = () => Date.now(),
  ) {}

  /** Candidates accumulate across batches in the debounce window, so a render burst costs one scan. */
  noteAddedNodes(mutations: MutationRecord[]): void {
    this.collectAddedShadowRootCandidates(mutations);
    if (this.pendingScan) {
      return;
    }
    this.pendingScan = true;
    if (this.scanTimeout) {
      globalThis.clearTimeout(this.scanTimeout);
    }
    this.scanTimeout = setTimeout(() => {
      this.scanTimeout = null;
      this.runScan();
      this.pendingScan = false;
      this.pendingMutationAddedElements.clear();
      this.pendingMutationAddedElementsOverflowed = false;
    }, this.scanDebounceMs);
  }

  /**
   * Replaces tracking with the result of a **complete** re-scan: a tracked host absent from
   * `scannedHosts` is dropped as hydrated-or-gone. A partial set silently evicts live tracking.
   */
  reconcileFromScan(scannedHosts: Set<Element>): void {
    this.reconcile(scannedHosts, this.now());
  }

  /**
   * Must exclude {@link hostsAwaitingDefinition}: on framework pages every unregistered component
   * selector (`<app-root>`, `<mat-form-field>`, …) parks there permanently, so including it would
   * report "work pending" forever. Coverage holds because the sweep promotes a host into this pool
   * the moment it flips `:defined`.
   */
  hasHostsAwaitingShadowRoot(): boolean {
    return this.hostsAwaitingShadowRoot.size > 0;
  }

  /**
   * `expiredHosts` deliberately survives: tombstones key on element identity, and clearing them
   * would let an expired host resurrect on the next scan.
   */
  reset(): void {
    if (this.retryTimeout) {
      globalThis.clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    if (this.scanTimeout) {
      globalThis.clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }
    this.hostsAwaitingShadowRoot.clear();
    this.overflowQueue.length = 0;
    this.hostsAwaitingDefinition.clear();
    this.pendingMutationAddedElements.clear();
    this.pendingMutationAddedElementsOverflowed = false;
    this.pendingScan = false;
    this.retryRound = 0;
  }

  private runScan = (): void => {
    const now = this.now();
    this.enrollUpgradedParkedHosts(now);

    const batch: Element[] = [];
    // Hosts added by mutation may have been removed during the scan debounce.
    for (const element of this.pendingMutationAddedElements) {
      if (element.isConnected) {
        batch.push(element);
      }
    }
    for (const element of this.hostsAwaitingShadowRoot.keys()) {
      if (element.isConnected && !this.pendingMutationAddedElements.has(element)) {
        batch.push(element);
      }
    }

    const { foundNewRoot, unresolvedHosts } = this.domQueryService.checkForNewShadowRoots(
      batch,
      this.mutationObserver,
    );
    if (foundNewRoot) {
      this.requestPageDetailsUpdate();
    }
    this.reconcile(unresolvedHosts, now);
  };

  private reconcile(scannedHosts: Set<Element>, now: EpochMs): void {
    const previousDeadlines = this.hostsAwaitingShadowRoot;
    this.hostsAwaitingShadowRoot = new Map();
    let sawNewHost = false;

    for (const element of scannedHosts) {
      if (this.expiredHosts.has(element)) {
        continue;
      }
      if (!element.matches(":defined")) {
        this.parkHost(element, now);
        continue;
      }
      if (!previousDeadlines.has(element)) {
        sawNewHost = true;
      }
      const expiresAt = previousDeadlines.get(element) ?? now + this.hostLifetimeMs;
      if (now >= expiresAt) {
        this.expiredHosts.add(element);
        continue;
      }
      this.admitHost(element, expiresAt);
    }

    this.drainOverflow(now);

    // Only new work restarts backoff; otherwise churn would pin it at the floor.
    if (sawNewHost) {
      this.noteNewWork();
    }

    this.scheduleRetry();
  }

  private admitHost(element: Element, expiresAt: EpochMs): void {
    if (this.hostsAwaitingShadowRoot.size < this.trackingCap) {
      this.hostsAwaitingShadowRoot.set(element, expiresAt);
    } else if (this.overflowQueue.length < this.overflowCap) {
      this.overflowQueue.push(element);
    }
  }

  private drainOverflow(now: EpochMs): void {
    while (this.overflowQueue.length > 0 && this.hostsAwaitingShadowRoot.size < this.trackingCap) {
      const element = this.overflowQueue.shift();
      if (
        element &&
        element.isConnected &&
        !this.expiredHosts.has(element) &&
        !this.hostsAwaitingShadowRoot.has(element)
      ) {
        // while-guard keeps size < cap, so admit always seats in the map here.
        this.admitHost(element, now + this.hostLifetimeMs);
      }
    }
  }

  /**
   * Polling `:defined` is the only enrollment path out of the parked pool, not a fallback. This
   * realm's `customElements` registry never learns a page-world `define()` (verified on a live
   * page), but `:defined` reads the shared DOM node's state, so the upgrade is visible here.
   */
  private enrollUpgradedParkedHosts(now: EpochMs): void {
    let enrolled = false;
    for (const [element, parkDeadline] of this.hostsAwaitingDefinition) {
      if (!element.isConnected) {
        this.hostsAwaitingDefinition.delete(element);
        continue;
      }
      if (element.matches(":defined")) {
        this.hostsAwaitingDefinition.delete(element);
        enrolled = true;
        this.admitHost(element, now + this.hostLifetimeMs);
        continue;
      }
      // Still undefined past its park deadline: give up and tombstone, so it can't re-park and
      // the retry timer can eventually settle.
      if (now >= parkDeadline) {
        this.hostsAwaitingDefinition.delete(element);
        this.expiredHosts.add(element);
      }
    }
    if (enrolled) {
      this.noteNewWork();
    }
  }

  private parkHost(element: Element, now: EpochMs): void {
    // Stamp once — re-parking on later scans must not refresh the deadline, or an element whose
    // tag never defines would postpone expiry forever.
    if (
      this.hostsAwaitingDefinition.size < this.awaitingDefinitionCap &&
      !this.hostsAwaitingDefinition.has(element)
    ) {
      this.hostsAwaitingDefinition.set(element, now + this.awaitingDefinitionLifetimeMs);
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimeout) {
      globalThis.clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    if (this.hostsAwaitingShadowRoot.size === 0 && this.hostsAwaitingDefinition.size === 0) {
      this.retryRound = 0;
      return;
    }
    // Exponential backoff (deadlines bound total work). Parked-only: sweep at cap cadence.
    const delay =
      this.hostsAwaitingShadowRoot.size === 0
        ? this.retryCapMs
        : Math.min(
            // Clamp the exponent: `<<` is a 32-bit shift, so an unclamped round would
            // eventually wrap to a tiny delay. 5 already exceeds the cap (500 << 5 = 16s).
            this.scanDebounceMs << Math.min(this.retryRound, 5),
            this.retryCapMs,
          );
    this.retryRound++;
    this.retryTimeout = setTimeout(() => {
      this.retryTimeout = null;
      this.runScan();
    }, delay);
  }

  private noteNewWork(): void {
    this.retryRound = 0;
  }

  // Residual gap: a plain (non-custom) element given `attachShadow()` later is never
  // a candidate and emits no mutation. Custom elements are covered by the re-scans.
  private collectAddedShadowRootCandidates(mutations: MutationRecord[]): void {
    if (this.pendingMutationAddedElementsOverflowed) {
      return;
    }
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes ?? []) {
        if (!this.isShadowRootCandidate(node)) {
          continue;
        }
        this.pendingMutationAddedElements.add(node);
        if (this.pendingMutationAddedElements.size >= this.pendingMutationAddedElementsCap) {
          this.pendingMutationAddedElementsOverflowed = true;
          // Keep the capped set so the debounced scan works through it incrementally.
          return;
        }
      }
    }
  }

  private isShadowRootCandidate(node: Node): node is Element {
    if (!nodeIsElement(node)) {
      return false;
    }
    if (node.shadowRoot) {
      return true;
    }
    // Custom element — `attachShadow` may run after observation.
    if (node.tagName.includes("-")) {
      return true;
    }
    return node.firstElementChild !== null;
  }
}
