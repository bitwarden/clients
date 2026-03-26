import { firstValueFrom, merge, Observable, Subscription } from "rxjs";
import { debounceTime, filter, skip } from "rxjs/operators";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import { UserEncryptor } from "../../../tools/cryptography/user-encryptor.abstraction";
import { UserId } from "../../../types/guid";
import { LogService } from "../../abstractions/log.service";
import { StateProvider } from "../../state";

import { PreferenceSyncApiService } from "./preference-sync-api.service";
import { DeviceType, SyncedPreferences } from "./synced-preferences";
import {
  SYNCED_KEYS,
  SyncScope,
  SyncedKeyEntry,
  PREFERENCE_SYNC_ENABLED,
} from "./synced-preferences-registry";
import { UserPreferencesRequest } from "./user-preferences.request";
import { UserPreferencesResponse } from "./user-preferences.response";

export class PreferenceSyncService {
  private _isSyncing = false;
  private pushSubscription: Subscription | null = null;

  constructor(
    private stateProvider: StateProvider,
    private encryptor$: Observable<UserEncryptor>,
    private preferenceSyncApiService: PreferenceSyncApiService,
    private logService: LogService,
    private deviceType: DeviceType,
  ) {}

  // ── Pull (server → local) ──

  async pull(response: UserPreferencesResponse | null, userId: UserId): Promise<void> {
    if (response?.data == null) {
      return;
    }

    const isEnabled = await this.isSyncEnabled(userId);
    if (!isEnabled) {
      return;
    }

    this._isSyncing = true;
    try {
      const prefs = await this.decryptBlob(response.data);
      if (prefs == null) {
        return;
      }

      // Apply shared settings
      if (prefs.shared != null) {
        await this.applySection(
          prefs.shared as unknown as Record<string, unknown>,
          SyncScope.Shared,
          userId,
        );
      }

      // Apply device-specific settings
      const deviceSection = prefs[this.deviceType];
      if (deviceSection != null) {
        await this.applySection(
          deviceSection as unknown as Record<string, unknown>,
          SyncScope.Device,
          userId,
        );
      }
    } catch (e) {
      this.logService.error("PreferenceSyncService: pull failed, preserving local state", e);
    } finally {
      this._isSyncing = false;
    }
  }

  // ── Push (local → server) ──

  startPushSync(userId: UserId): void {
    this.stopPushSync();

    const observables = SYNCED_KEYS.filter((entry) => this.isEntryRelevant(entry)).map((entry) =>
      this.stateProvider.getUser(userId, entry.keyDef).state$.pipe(
        skip(1), // skip initial emission to avoid pushing on subscribe
      ),
    );

    if (observables.length === 0) {
      return;
    }

    this.pushSubscription = merge(...observables)
      .pipe(
        filter(() => !this._isSyncing),
        debounceTime(2000),
      )
      .subscribe(() => {
        void this.pushToServer(userId);
      });
  }

  stopPushSync(): void {
    this.pushSubscription?.unsubscribe();
    this.pushSubscription = null;
  }

  // ── Initial seed (when user first enables sync) ──

  async pushCurrentState(userId: UserId): Promise<void> {
    const blob = await this.collectAndEncrypt(userId);
    if (blob != null) {
      await this.preferenceSyncApiService.putUserPreferences(new UserPreferencesRequest(blob));
    }
  }

  // ── Private helpers ──

  private async pushToServer(userId: UserId): Promise<void> {
    try {
      const isEnabled = await this.isSyncEnabled(userId);
      if (!isEnabled) {
        return;
      }

      const blob = await this.collectAndEncrypt(userId);
      if (blob != null) {
        await this.preferenceSyncApiService.putUserPreferences(new UserPreferencesRequest(blob));
      }
    } catch (e) {
      this.logService.error("PreferenceSyncService: push failed", e);
    }
  }

  private async isSyncEnabled(userId: UserId): Promise<boolean> {
    const enabled = await firstValueFrom(
      this.stateProvider.getUser(userId, PREFERENCE_SYNC_ENABLED).state$,
    );
    return enabled === true;
  }

  private async collectAndEncrypt(userId: UserId): Promise<string | null> {
    const prefs = await this.collectAll(userId);
    return this.encryptBlob(prefs);
  }

  private async collectAll(userId: UserId): Promise<SyncedPreferences> {
    const shared: Record<string, unknown> = {};
    const device: Record<string, unknown> = {};

    for (const entry of SYNCED_KEYS) {
      if (!this.isEntryRelevant(entry)) {
        continue;
      }

      const value = await firstValueFrom(this.stateProvider.getUser(userId, entry.keyDef).state$);

      if (value === undefined || value === null) {
        continue;
      }

      if (entry.scope === SyncScope.Shared) {
        shared[entry.blobField] = value;
      } else {
        device[entry.blobField] = value;
      }
    }

    const prefs: SyncedPreferences = {};

    if (Object.keys(shared).length > 0) {
      prefs.shared = shared as SyncedPreferences["shared"];
    }

    if (Object.keys(device).length > 0) {
      (prefs as Record<string, unknown>)[this.deviceType] = device;
    }

    return prefs;
  }

  private async applySection(
    section: Record<string, unknown>,
    scope: SyncScope,
    userId: UserId,
  ): Promise<void> {
    for (const entry of SYNCED_KEYS) {
      if (entry.scope !== scope) {
        continue;
      }
      if (!this.isEntryRelevant(entry)) {
        continue;
      }

      const value = section[entry.blobField];
      if (value === undefined) {
        continue;
      }

      try {
        await this.stateProvider.getUser(userId, entry.keyDef).update(() => value);
      } catch (e) {
        this.logService.error(`PreferenceSyncService: failed to apply ${entry.blobField}`, e);
      }
    }
  }

  private isEntryRelevant(entry: SyncedKeyEntry): boolean {
    if (entry.scope === SyncScope.Shared) {
      return true;
    }
    // Device-scoped: relevant if no section specified (all devices) or section matches
    return entry.section == null || entry.section === this.deviceType;
  }

  private async getEncryptor(): Promise<UserEncryptor | null> {
    const encryptor = await firstValueFrom(this.encryptor$.pipe(filter((e) => e != null)));
    return encryptor ?? null;
  }

  private async encryptBlob(prefs: SyncedPreferences): Promise<string | null> {
    const encryptor = await this.getEncryptor();
    if (encryptor == null) {
      this.logService.warning("PreferenceSyncService: no encryptor available");
      return null;
    }

    // Cast required: SyncedPreferences uses Record<string, unknown> for generator
    // fields to avoid circular deps, which Jsonify's index signature rejects.
    const encString = await encryptor.encrypt(prefs as unknown as Record<string, string>);
    return encString?.encryptedString ?? null;
  }

  private async decryptBlob(encryptedData: string): Promise<SyncedPreferences | null> {
    const encryptor = await this.getEncryptor();
    if (encryptor == null) {
      this.logService.warning("PreferenceSyncService: no encryptor available");
      return null;
    }

    try {
      const encString = new EncString(encryptedData);
      const decrypted = await encryptor.decrypt<Record<string, unknown>>(encString);
      return decrypted as unknown as SyncedPreferences;
    } catch (e) {
      this.logService.error("PreferenceSyncService: failed to decrypt preferences blob", e);
      return null;
    }
  }
}
