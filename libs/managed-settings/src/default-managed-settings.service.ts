import { defer, distinctUntilChanged, map, Observable, startWith, switchMap } from "rxjs";

import { ManagedSettingsClient } from "@bitwarden/sdk-internal";

import { ManagedSettingsService } from "./managed-settings.service";

/**
 * Default {@link ManagedSettingsService}.
 *
 * The SDK handle holds the active profile, and every read goes through it. The handle is created
 * once the SDK WASM module has loaded; until then {@link get} returns `undefined` and
 * {@link isManaged} returns `false`. {@link get$} is driven by the handle's change signal.
 */
export class DefaultManagedSettingsService extends ManagedSettingsService {
  private client: ManagedSettingsClient | undefined;
  private readonly clientPromise: Promise<ManagedSettingsClient>;

  readonly client$ = defer(() => this.clientPromise);

  /**
   * Emits once on subscribe, once more when the handle is created, and after every profile change.
   * Carries no value; subscribers read the current profile through the handle.
   */
  private readonly changed$: Observable<void> = this.client$.pipe(
    switchMap((client) => profileChanges(client)),
    startWith(undefined),
  );

  /**
   * @param sdkReady - A promise that resolves when the SDK WASM has been loaded and initialized.
   *   Pass `SdkLoadService.Ready` in DI-enabled contexts. Taking the promise rather than importing
   *   `SdkLoadService` keeps this library off `@bitwarden/common`, which depends on it in turn.
   */
  constructor(sdkReady: Promise<void>) {
    super();
    // Created as soon as the SDK has loaded, rather than on first use of client$, so synchronous
    // reads resolve against the profile from then on.
    this.clientPromise = sdkReady.then(() => {
      this.client = new ManagedSettingsClient();
      return this.client;
    });
    // A failed SDK load surfaces to every subscriber of client$; it is not reported twice here.
    this.clientPromise.catch(() => {});
  }

  get(key: string): string | undefined {
    return this.client?.get(key);
  }

  get$(key: string): Observable<string | undefined> {
    return this.changed$.pipe(
      map(() => this.get(key)),
      distinctUntilChanged(),
    );
  }

  isManaged(key: string): boolean {
    return this.client?.is_managed(key) ?? false;
  }
}

/** Emits once on subscribe, then after every change to the profile `client` holds. */
function profileChanges(client: ManagedSettingsClient): Observable<void> {
  return new Observable<void>((subscriber) => {
    const abort = new AbortController();
    client.on_profile_changed(() => subscriber.next(), abort.signal);
    subscriber.next();
    return () => abort.abort();
  });
}
