import { firstValueFrom, from, map, race } from "rxjs";

import {
  anyCancellation,
  cancellationToken,
  type CancellationToken,
} from "../../utils/cancellation";
import { TargetSource } from "../enums";
import type { FillResult } from "../types";
import { AUTOFILL_CANCELLED } from "../utils";

import { scopesOverlap, type LeaseScope } from "./lease-scope";

/** How a fill's source ranks it: a fill preempts conflicting fills of a lower rank. */
const RANK: Readonly<Record<TargetSource, number>> = Object.freeze({
  [TargetSource.Reported]: 0,
  [TargetSource.User]: 1,
  [TargetSource.Policy]: 2,
});

/** A fill as it arrives. */
export type FillArrival = Readonly<{
  scope: LeaseScope;
  /** Who started the fill. It is the fill's plan's target source. */
  source: TargetSource;
  /**
   * Cancels the fill. The caller composes it, including the end of the fill's tab, which the lease
   * does not watch. Preemption cancels the token handed to the fill's work, not this one.
   */
  cancellation: CancellationToken;
}>;

/** A collect as it arrives. */
export type CollectArrival = Readonly<{
  scope: LeaseScope;
  /**
   * Cancels the collect while it waits, and is handed to its work. The caller composes it, including
   * the end of the collect's tab, which the lease does not watch.
   */
  cancellation: CancellationToken;
}>;

/** What a fill records, beside what every request does. Its lease is exclusive. */
type FillFields = Readonly<{
  exclusive: true;
  /** The fill's rank, from its source. */
  rank: number;
  /** Cancels the fill's token. */
  preempt: () => void;
}>;

/** What a collect records, beside what every request does. Its lease is shared. */
type CollectFields = Readonly<{ exclusive: false }>;

/** A request, holding or waiting for its lease. */
type LeaseRequest = (FillFields | CollectFields) &
  Readonly<{
    scope: LeaseScope;
    /** The token its work reads. A fill whose token is cancelled is ending. */
    token: CancellationToken;
    /** Resolves once the request has completed. */
    completed: Promise<void>;
    /** Resolves `completed`. */
    complete: () => void;
  }>;

/** A fill, holding or waiting for its lease. */
type FillRequest = Extract<LeaseRequest, FillFields>;

/**
 * Orders the fills and collects that touch a tab, as `model.md` describes. A request arrives when
 * {@link fill} or {@link collect} is called: it is decided, and recorded in arrival order, before the
 * method returns.
 *
 * Fills never wait in line for one another. When any fill in an arriving fill's way is not ending and
 * does not rank below it, the arriving fill completes as cancelled, and preempts nothing. Otherwise it
 * preempts each fill in its way that is not ending, and waits for every one of them to complete.
 *
 * A request completes only when its work completes, or when its token is cancelled while it waits.
 * The lease does not watch tabs, so the caller's token carries the end of the request's tab. A fill
 * collects inside its own lease, through its work, never through {@link collect}: a collect on an
 * overlapping scope would wait for the fill that requested it.
 */
export class FillLeases {
  /** Each tab's requests that hold or wait for a lease, in arrival order. */
  private readonly tabs = new Map<number, LeaseRequest[]>();

  /**
   * Runs a fill under an exclusive lease on its scope. Resolves to what `work` resolves to, or to
   * `AUTOFILL_CANCELLED` when the fill never runs: it arrived cancelled, a fill in its way that is not
   * ending did not rank below it, or it was cancelled while it waited. Rejects when `work` rejects.
   *
   * `work` receives the fill's token: the arrival's token, composed with the lease's preemption.
   * Once `work` has begun, preemption only cancels that token; the fill's result is what `work`
   * resolves to after reading it. The lease is released when the fill completes.
   */
  fill(
    arrival: FillArrival,
    work: (cancellation: CancellationToken) => Promise<FillResult>,
  ): Promise<FillResult> {
    const { scope, cancellation } = arrival;
    if (cancellation.cancelled) {
      return Promise.resolve(AUTOFILL_CANCELLED);
    }
    const rank = RANK[arrival.source];
    const arrivedBefore = this.conflicting(scope, true);
    const inTheWay = arrivedBefore.filter((request): request is FillRequest => request.exclusive);
    // Decided against every fill in its way at once, so a fill that completes as cancelled preempts
    // nothing.
    if (inTheWay.some((fill) => !fill.token.cancelled && fill.rank >= rank)) {
      return Promise.resolve(AUTOFILL_CANCELLED);
    }
    for (const fill of inTheWay) {
      fill.preempt();
    }

    const preemption = cancellationToken();
    const request = this.arrive(scope, {
      exclusive: true,
      rank,
      token: anyCancellation(cancellation, preemption.token),
      preempt: preemption.cancel,
    });
    return this.run(request, arrivedBefore, work, AUTOFILL_CANCELLED);
  }

  /**
   * Runs a collect under a shared lease on its scope, once every conflicting fill that arrived before
   * it has completed. Resolves to what `work` resolves to, or to `none` when the collect never runs:
   * it arrived cancelled, or was cancelled while it waited. Rejects when `work` rejects.
   *
   * `work` receives the arrival's token. A collect is never preempted.
   */
  collect<T>(
    arrival: CollectArrival,
    work: (cancellation: CancellationToken) => Promise<T>,
    none: T,
  ): Promise<T> {
    const { scope, cancellation } = arrival;
    if (cancellation.cancelled) {
      return Promise.resolve(none);
    }
    const arrivedBefore = this.conflicting(scope, false);
    const request = this.arrive(scope, {
      exclusive: false,
      token: cancellation,
    });
    return this.run(request, arrivedBefore, work, none);
  }

  /**
   * The requests on `scope`'s tab that conflict with a request arriving on it. A fill conflicts with
   * every request whose scope overlaps its own; a collect, only with fills.
   */
  private conflicting(scope: LeaseScope, exclusive: boolean): LeaseRequest[] {
    return (this.tabs.get(scope.tabId) ?? []).filter(
      (request) => (exclusive || request.exclusive) && scopesOverlap(request.scope, scope),
    );
  }

  /** Records a request on its tab, in arrival order, and returns it. */
  private arrive(
    scope: LeaseScope,
    fields: (FillFields | CollectFields) & Pick<LeaseRequest, "token">,
  ): LeaseRequest {
    let complete!: () => void;
    const completed = new Promise<void>((resolve) => (complete = resolve));
    const request: LeaseRequest = { ...fields, scope, completed, complete };
    const tab = this.tabs.get(scope.tabId);
    if (tab) {
      tab.push(request);
    } else {
      this.tabs.set(scope.tabId, [request]);
    }
    return request;
  }

  /**
   * Waits until every request in `arrivedBefore` has completed, then runs `work`. A token cancelled first
   * ends the wait, and the request completes with `none`. The request leaves its tab when it
   * completes, however it completes.
   */
  private async run<T>(
    request: LeaseRequest,
    arrivedBefore: readonly LeaseRequest[],
    work: (cancellation: CancellationToken) => Promise<T>,
    none: T,
  ): Promise<T> {
    try {
      const granted = await firstValueFrom(
        race(
          from(Promise.all(arrivedBefore.map((before) => before.completed))).pipe(map(() => true)),
          request.token.cancelled$.pipe(map(() => false)),
        ),
      );
      if (!granted) {
        return none;
      }
      return await work(request.token);
    } finally {
      this.leave(request);
    }
  }

  /** Removes a request from its tab, and lets the requests that wait for it proceed. */
  private leave(request: LeaseRequest): void {
    const tab = this.tabs.get(request.scope.tabId);
    const index = tab?.indexOf(request) ?? -1;
    if (tab && index >= 0) {
      tab.splice(index, 1);
      if (tab.length === 0) {
        this.tabs.delete(request.scope.tabId);
      }
    }
    request.complete();
  }
}
