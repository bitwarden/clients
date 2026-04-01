import { firstValueFrom, merge, Observable, Subscription } from "rxjs";
import { debounceTime, filter, map, skip } from "rxjs/operators";

import { ApiService } from "../../../abstractions/api.service";
import { EncryptService } from "../../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../../key-management/crypto/models/enc-string";
import { UserId } from "../../../types/guid";
import { LogService } from "../../abstractions/log.service";
import { PlatformUtilsService } from "../../abstractions/platform-utils.service";
import { SymmetricCryptoKey } from "../../models/domain/symmetric-crypto-key";
import { StateProvider } from "../../state";

import { SyncedPreferences } from "./synced-preferences";
import {
  SYNCED_KEYS,
  SyncScope,
  SyncedKeyEntry,
  PREFERENCE_SYNC_ENABLED,
  isGlobalEntry,
} from "./synced-preferences-registry";
import { UserPreferencesRequest } from "./user-preferences.request";
import { UserPreferencesResponse } from "./user-preferences.response";

/** Callback to retrieve the user's symmetric encryption key. */
export type UserKeyProvider = (userId: UserId) => Promise<SymmetricCryptoKey | null>;

export class PreferenceSyncService {
  private _isSyncing = false;
  private pushSubscription: Subscription | null = null;

  constructor(
    private stateProvider: StateProvider,
    private encryptService: EncryptService,
    private getUserKey: UserKeyProvider,
    private apiService: ApiService,
    private logService: LogService,
    private platformUtilsService: PlatformUtilsService,
  ) {}

  private get clientType() {
    return this.platformUtilsService.getClientType();
  }

  async applySyncedUserPreferences(
    response: UserPreferencesResponse | null,
    userId: UserId,
  ): Promise<void> {
    if (response?.data == null) {
      return;
    }

    const isEnabled = await this.isSyncEnabled(userId);
    if (!isEnabled) {
      return;
    }

    this._isSyncing = true;
    try {
      const prefs = await this.decryptBlob(response.data, userId);
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
      const deviceSection = (prefs as Record<string, unknown>)[this.clientType] as
        | Record<string, unknown>
        | undefined;
      if (deviceSection != null) {
        await this.applySection(deviceSection, SyncScope.Device, userId);
      }
    } catch (e) {
      this.logService.error("PreferenceSyncService: apply failed, preserving local state", e);
    } finally {
      this._isSyncing = false;
    }
  }

  beginSyncedKeyWatch(userId: UserId): void {
    this.stopSyncedKeyWatch();

    const observables = SYNCED_KEYS.filter((entry) => this.isEntryRelevant(entry)).map((entry) =>
      this.getStateAccessor(entry, userId).state$.pipe(
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

  stopSyncedKeyWatch(): void {
    this.pushSubscription?.unsubscribe();
    this.pushSubscription = null;
  }

  syncEnabled$(userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUser(userId, PREFERENCE_SYNC_ENABLED)
      .state$.pipe(map((v) => v === true));
  }

  async setSyncEnabled(userId: UserId, enabled: boolean): Promise<void> {
    await this.stateProvider.getUser(userId, PREFERENCE_SYNC_ENABLED).update(() => enabled);
    if (enabled) {
      try {
        const response = await this.getUserPreferences();
        if (response?.data != null) {
          await this.applySyncedUserPreferences(response, userId);
        } else {
          await this.pushToServer(userId);
        }
      } catch (e) {
        this.logService.error("PreferenceSyncService: initial sync on enable failed", e);
      }
    }
  }

  private async pushToServer(userId: UserId): Promise<void> {
    try {
      const isEnabled = await this.isSyncEnabled(userId);
      if (!isEnabled) {
        return;
      }

      const blob = await this.collectAndEncrypt(userId);
      if (blob != null) {
        await this.putUserPreferences(new UserPreferencesRequest(blob));
      }
    } catch (e) {
      this.logService.error("PreferenceSyncService: push failed", e);
    }
  }

  private async isSyncEnabled(userId: UserId): Promise<boolean> {
    return await firstValueFrom(this.syncEnabled$(userId));
  }

  private async collectAndEncrypt(userId: UserId): Promise<string | undefined> {
    const prefs = await this.collectAll(userId);
    return this.encryptBlob(prefs, userId);
  }

  private async collectAll(userId: UserId): Promise<SyncedPreferences> {
    const shared: Record<string, unknown> = {};
    const device: Record<string, unknown> = {};

    for (const entry of SYNCED_KEYS) {
      if (!this.isEntryRelevant(entry)) {
        continue;
      }

      const value = await firstValueFrom(this.getStateAccessor(entry, userId).state$);

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
      (prefs as Record<string, unknown>)[this.clientType] = device;
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
        await this.getStateAccessor(entry, userId).update(() => value);
      } catch (e) {
        this.logService.error(`PreferenceSyncService: failed to apply ${entry.blobField}`, e);
      }
    }
  }

  private getStateAccessor(entry: SyncedKeyEntry, userId: UserId) {
    if (isGlobalEntry(entry)) {
      return this.stateProvider.getGlobal(entry.keyDef);
    }
    return this.stateProvider.getUser(userId, entry.keyDef);
  }

  private isEntryRelevant(entry: SyncedKeyEntry): boolean {
    if (entry.scope === SyncScope.Shared) {
      return true;
    }
    // Device-scoped: relevant if no section specified (all devices) or section matches
    return entry.device == null || entry.device === this.clientType;
  }

  private async encryptBlob(prefs: SyncedPreferences, userId: UserId): Promise<string | undefined> {
    const key = await this.getUserKey(userId);
    if (key == null) {
      this.logService.warning("PreferenceSyncService: no user key available for encryption");
      return undefined;
    }

    const json = JSON.stringify(prefs);
    const encString = await this.encryptService.encryptString(json, key);
    return encString.encryptedString;
  }

  private async decryptBlob(
    encryptedData: string,
    userId: UserId,
  ): Promise<SyncedPreferences | null> {
    const key = await this.getUserKey(userId);
    if (key == null) {
      this.logService.warning("PreferenceSyncService: no user key available for decryption");
      return null;
    }

    try {
      const encString = new EncString(encryptedData);
      const json = await this.encryptService.decryptString(encString, key);
      return JSON.parse(json) as SyncedPreferences;
    } catch (e) {
      this.logService.error("PreferenceSyncService: failed to decrypt preferences blob", e);
      return null;
    }
  }

  private async getUserPreferences(): Promise<UserPreferencesResponse> {
    const r = await this.apiService.send("GET", "/user-preferences", null, true, true);
    return new UserPreferencesResponse(r);
  }

  private async putUserPreferences(request: UserPreferencesRequest): Promise<void> {
    await this.apiService.send("PUT", "/user-preferences", request, true, false);
  }
}
