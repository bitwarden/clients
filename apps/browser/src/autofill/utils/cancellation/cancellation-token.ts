import { merge, Observable, ReplaySubject, take } from "rxjs";

import { CancellationToken } from "./abstractions";

/** What the token reads, and the source writes. It is kept apart so that a frozen token stays whole. */
type CancellationState = { cancelled: boolean };

/** The token a source cancels. It is made only by {@link cancellationToken}. */
class DefaultCancellationToken implements CancellationToken {
  constructor(
    private readonly state: CancellationState,
    readonly cancelled$: Observable<void>,
  ) {}

  get cancelled(): boolean {
    return this.state.cancelled;
  }
}

/** A token, and the means to cancel it. The party that holds `cancel` is the token's source. */
export type CancellationSource = Readonly<{
  /** Cancels the token. Cancelling a token that is cancelled does nothing. */
  cancel: () => void;
  token: CancellationToken;
}>;

/**
 * Makes a token that is not cancelled, and the means to cancel it. Hand the token to the work, and
 * keep `cancel` with whatever decides that the work stops. `cancel` stands alone, so it can be
 * handed to a subscriber as it is.
 */
export function cancellationToken(): CancellationSource {
  const state: CancellationState = { cancelled: false };
  const cancelled = new ReplaySubject<void>(1);

  return {
    cancel: () => {
      if (state.cancelled) {
        return;
      }
      state.cancelled = true;
      cancelled.next();
      cancelled.complete();
    },
    token: new DefaultCancellationToken(state, cancelled.asObservable()),
  };
}

/**
 * A token that is never cancelled. It is the default of work that nothing cancels, so work that
 * takes a token needs no branch for having none. The instance is frozen and shared. Its means to
 * cancel is not kept.
 */
export const NEVER_CANCEL: CancellationToken = Object.freeze(cancellationToken().token);

/** A token that is cancelled when any of the tokens it reads is. It holds nothing of its own. */
class AnyCancellationToken implements CancellationToken {
  readonly cancelled$: Observable<void>;

  constructor(private readonly tokens: readonly CancellationToken[]) {
    this.cancelled$ = merge(...tokens.map((token) => token.cancelled$)).pipe(take(1));
  }

  get cancelled(): boolean {
    return this.tokens.some((token) => token.cancelled);
  }
}

/**
 * A token that is cancelled when any of `tokens` is, whatever cancelled it. It reads the tokens and
 * subscribes to nothing until its own stream is subscribed, so it holds no resources and nothing
 * disposes it. Composing no tokens is a token that is never cancelled.
 */
export function anyCancellation(...tokens: CancellationToken[]): CancellationToken {
  if (tokens.length === 0) {
    return NEVER_CANCEL;
  }
  return new AnyCancellationToken(tokens);
}
