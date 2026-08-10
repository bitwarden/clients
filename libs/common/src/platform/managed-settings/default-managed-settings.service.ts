import { BehaviorSubject, distinctUntilChanged, map, Observable, ReplaySubject } from "rxjs";

import { ManagedSettingsClient, ManagementProfile } from "@bitwarden/sdk-internal";

import { SdkLoadService } from "../abstractions/sdk/sdk-load.service";

import { ManagedSettingsService } from "./managed-settings.service";

/**
 * Default {@link ManagedSettingsService}.
 *
 * Owns the singleton WASM {@link ManagedSettingsClient}, which can only be constructed once the SDK
 * WASM module has loaded. The handle is therefore created asynchronously after
 * {@link SdkLoadService.Ready} resolves. Reads before the handle exists resolve to "unmanaged"
 * ({@link get} returns `undefined`, {@link isManaged} returns `false`), and a {@link updateProfile}
 * that arrives before the handle exists is buffered and applied once the handle resolves rather than
 * being lost or throwing.
 */
export class DefaultManagedSettingsService extends ManagedSettingsService {
  private readonly clientSubject = new ReplaySubject<ManagedSettingsClient>(1);
  client$: Observable<ManagedSettingsClient> = this.clientSubject.asObservable();

  /** The WASM handle, undefined until {@link SdkLoadService.Ready} resolves. */
  private client?: ManagedSettingsClient;

  /**
   * Buffer for a {@link updateProfile} that arrives before {@link client} exists. Only the latest
   * push matters, so a single slot is kept. `hasBufferedUpdate` distinguishes "no push yet" from a
   * buffered clear (`updateProfile(undefined)`).
   */
  private hasBufferedUpdate = false;
  private bufferedProfile: ManagementProfile | undefined;

  /** Reactive signal that fires whenever the active profile changes, driving {@link get$}. */
  private readonly changed$ = new BehaviorSubject<void>(undefined);

  constructor() {
    super();
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    await SdkLoadService.Ready;

    const client = new ManagedSettingsClient();
    this.client = client;

    if (this.hasBufferedUpdate) {
      client.update_profile(this.bufferedProfile);
      this.hasBufferedUpdate = false;
      this.bufferedProfile = undefined;
    }

    this.changed$.next();
    this.clientSubject.next(client);
  }

  get(key: string): string | undefined {
    return this.client?.get(key) ?? undefined;
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

  updateProfile(profile: ManagementProfile | undefined): void {
    if (this.client == null) {
      this.hasBufferedUpdate = true;
      this.bufferedProfile = profile;
      return;
    }

    this.client.update_profile(profile);
    this.changed$.next();
  }
}
