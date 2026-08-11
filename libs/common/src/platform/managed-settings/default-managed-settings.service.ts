// Stand-in for PM-27720 (Managed Settings). Resolution here reads the profile's `settings` Map
// directly; the real implementation resolves through the SDK's WASM managed-settings client.

import { BehaviorSubject, Observable, distinctUntilChanged, map } from "rxjs";

import { ManagedSettingsService } from "./managed-settings.service";
import { ManagementProfile } from "./management-profile";

export class DefaultManagedSettingsService extends ManagedSettingsService {
  private readonly profile$ = new BehaviorSubject<ManagementProfile | undefined>(undefined);

  get(key: string): string | undefined {
    return this.profile$.value?.settings.get(key);
  }

  get$(key: string): Observable<string | undefined> {
    return this.profile$.pipe(
      map(() => this.get(key)),
      distinctUntilChanged(),
    );
  }

  isManaged(key: string): boolean {
    return this.profile$.value?.settings.has(key) ?? false;
  }

  updateProfile(profile: ManagementProfile | undefined): void {
    this.profile$.next(profile);
  }
}
