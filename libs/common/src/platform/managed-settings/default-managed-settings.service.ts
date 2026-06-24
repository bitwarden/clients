import { Observable, ReplaySubject, Subject, from, shareReplay, switchMap } from "rxjs";

import { ManagedSettingsClient, ManagementProfile } from "@bitwarden/sdk-internal";

import { SdkLoadService } from "../abstractions/sdk/sdk-load.service";

import { ManagedSettingsService } from "./managed-settings.service";

export class DefaultManagedSettingsService extends ManagedSettingsService {
  private readonly _changes = new Subject<void>();
  private _handle?: ManagedSettingsClient;

  // Construct the wasm handle only after the SDK module is loaded.
  readonly handle$: Observable<ManagedSettingsClient> = from(SdkLoadService.Ready).pipe(
    switchMap(() => {
      this._handle ??= new ManagedSettingsClient();
      const subject = new ReplaySubject<ManagedSettingsClient>(1);
      subject.next(this._handle);
      return subject;
    }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  readonly changes$ = this._changes.asObservable();

  constructor() {
    super();
    // Eagerly trigger handle creation so reads work as soon as wasm is up.
    this.handle$.subscribe();
  }

  isManaged(key: string): boolean {
    return this._handle?.is_managed(key) ?? false;
  }

  get(key: string): string | undefined {
    return this._handle?.get(key) ?? undefined;
  }

  updateProfile(profile: ManagementProfile | undefined): void {
    this._handle?.update_profile(profile);
    this._changes.next();
  }

  pushExplicit(values: Record<string, unknown>): void {
    const settings: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      settings[k] = JSON.stringify(v);
    }
    this.updateProfile({ version: 1, updatedAt: Math.floor(Date.now() / 1000), settings });
  }
}
