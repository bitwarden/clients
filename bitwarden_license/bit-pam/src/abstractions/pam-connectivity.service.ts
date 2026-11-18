import type { Observable } from "rxjs";

/**
 * Whether PAM actions can reach the server. Optional: a client that does not provide it is treated
 * as always online, so the shared surfaces behave as they did before it existed. The desktop app
 * provides it; the web vault does not.
 */
export abstract class PamConnectivityService {
  /**
   * `true` while PAM actions are unavailable, because the device has no network or the server
   * cannot be reached. Debounced, so a brief blip does not flicker. Replays the latest value.
   */
  abstract readonly offline$: Observable<boolean>;

  /**
   * Ticks once each time {@link offline$} goes from `true` to `false`, so surfaces can re-read state
   * the server may have changed while they could not hear it. No replay. Never replays a user
   * action: consumers re-read, they never retry a mutation.
   */
  abstract readonly reconnected$: Observable<void>;
}
