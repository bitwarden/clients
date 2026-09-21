import { BehaviorSubject, defer, distinctUntilChanged, map, Observable } from "rxjs";

import { ManagedSettingsClient, ManagementProfile } from "@bitwarden/sdk-internal";

import { ManagedSettingsService } from "./managed-settings.service";

/**
 * Default {@link ManagedSettingsService}.
 *
 * The most recently pushed profile is held here, in JavaScript, and mirrored into the SDK handle
 * once the WASM module has loaded. Reads resolve against the JavaScript copy rather than the
 * handle, so {@link get} and {@link isManaged} keep their synchronous contract from construction,
 * before WASM is available. The handle exists so that the SDK reads the same profile.
 */
export class DefaultManagedSettingsService extends ManagedSettingsService {
  private readonly profile = new BehaviorSubject<ManagementProfile | undefined>(undefined);
  private clientPromise: Promise<ManagedSettingsClient> | undefined;

  readonly client$ = defer(() => this.getClient());

  /**
   * @param sdkReady - A promise that resolves when the SDK WASM has been loaded and initialized.
   *   Pass `SdkLoadService.Ready` in DI-enabled contexts. Taking the promise rather than importing
   *   `SdkLoadService` keeps this library off `@bitwarden/common`, which depends on it in turn.
   */
  constructor(private readonly sdkReady: Promise<void>) {
    super();
  }

  get(key: string): string | undefined {
    return this.profile.value?.settings.get(key);
  }

  get$(key: string): Observable<string | undefined> {
    return this.profile.pipe(
      map((profile) => profile?.settings.get(key)),
      distinctUntilChanged(),
    );
  }

  isManaged(key: string): boolean {
    return this.profile.value?.settings.has(key) ?? false;
  }

  updateProfile(profile: ManagementProfile | undefined): void {
    this.profile.next(profile);
  }

  /**
   * Lazily create the SDK handle, then keep it fed. Subscribing to the profile here replays the
   * latest push before following subsequent ones, so a profile that arrived while WASM was still
   * loading is not lost.
   */
  private getClient(): Promise<ManagedSettingsClient> {
    if (this.clientPromise == null) {
      this.clientPromise = this.sdkReady.then(() => {
        const client = new ManagedSettingsClient();
        this.profile.subscribe((profile) => client.update_profile(profile));
        return client;
      });
    }
    return this.clientPromise;
  }
}
