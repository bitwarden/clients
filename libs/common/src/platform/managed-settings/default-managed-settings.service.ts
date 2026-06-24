import { Observable, Subject, from, of, shareReplay, switchMap } from "rxjs";

import { ManagedSettingsClient, ManagementProfile } from "@bitwarden/sdk-internal";

import { SdkLoadService } from "../abstractions/sdk/sdk-load.service";

import { ManagedSettingsService } from "./managed-settings.service";

export class DefaultManagedSettingsService extends ManagedSettingsService {
  private readonly _changes = new Subject<void>();
  private _handle?: ManagedSettingsClient;
  private _pendingProfile: ManagementProfile | undefined;
  private _hasPending = false;

  // Construct the wasm handle only after the SDK module is loaded.
  readonly handle$: Observable<ManagedSettingsClient> = from(SdkLoadService.Ready).pipe(
    switchMap(() => {
      this._handle ??= new ManagedSettingsClient();
      if (this._hasPending) {
        this._handle.update_profile(this._pendingProfile);
        this._hasPending = false;
        this._pendingProfile = undefined;
        this._changes.next();
      }
      return of(this._handle);
    }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  readonly changes$ = this._changes.asObservable();

  constructor() {
    super();
    // Eagerly create the handle so synchronous reads work once wasm resolves.
    // shareReplay({ refCount: false }) keeps it alive for the app's lifetime;
    // no teardown by design (process-lifetime singleton service).
    this.handle$.subscribe();
  }

  isManaged(key: string): boolean {
    return this._handle?.is_managed(key) ?? false;
  }

  get(key: string): string | undefined {
    return this._handle?.get(key);
  }

  updateProfile(profile: ManagementProfile | undefined): void {
    if (this._handle == null) {
      this._pendingProfile = profile;
      this._hasPending = true;
      return;
    }
    this._handle.update_profile(profile);
    this._changes.next();
  }

  pushExplicit(values: Record<string, unknown>): void {
    const settings = new Map<string, string>();
    for (const [k, v] of Object.entries(values)) {
      settings.set(k, JSON.stringify(v));
    }
    this.updateProfile({ version: 1, updatedAt: Math.floor(Date.now() / 1000), settings });
  }
}
