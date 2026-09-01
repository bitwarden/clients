import {
  combineLatest,
  concatMap,
  distinctUntilChanged,
  firstValueFrom,
  map,
  Observable,
  Subscription,
} from "rxjs";

import { SharedUnlockClient, SharedUnlockPeer } from "@bitwarden/sdk-internal";
import { LockService, LockSource, UnlockMethod, UnlockService } from "@bitwarden/unlock";

import { AccountService } from "../../auth/abstractions/account.service";
import { ClientType } from "../../enums";
import { FeatureFlag } from "../../enums/feature-flag.enum";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { EnvironmentService } from "../../platform/abstractions/environment.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { asUuid } from "../../platform/abstractions/sdk/sdk.service";
import { IpcService } from "../../platform/ipc";
import { UserId } from "../../types/guid";
import { VaultTimeoutSettingsService } from "../vault-timeout/abstractions/vault-timeout-settings.service";

import { JsSharedUnlockDriver } from "./shared-unlock-driver";
import { SharedUnlockPeerService } from "./shared-unlock-peer.service";
import { SharedUnlockSettingsService } from "./shared-unlock-settings.service";

const NO_DESTINATIONS: SharedUnlockClient[] = [];
// Desktop and web do not choose peers; they only ever share with the extension.
const BROWSER_ONLY: SharedUnlockClient[] = ["Browser"];

function sameDestinations(a: SharedUnlockClient[], b: SharedUnlockClient[]): boolean {
  return a.length === b.length && a.every((client, i) => client === b[i]);
}

export class DefaultSharedUnlockPeerService implements SharedUnlockPeerService {
  private peer: SharedUnlockPeer | null = null;
  /** The live destination subscription per account, which is also the set of accounts seen so far. */
  private readonly destinationSubscriptions = new Map<UserId, Subscription>();

  constructor(
    private ipcService: IpcService,
    private accountService: AccountService,
    private lockService: LockService,
    private platformUtilsService: PlatformUtilsService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private environmentService: EnvironmentService,
    private sharedUnlockSettingsService: SharedUnlockSettingsService,
    private unlockService: UnlockService,
    private configService: ConfigService,
  ) {}

  async start(): Promise<void> {
    const sharedUnlockDriver = new JsSharedUnlockDriver(
      this.accountService,
      this.lockService,
      this.unlockService,
      this.platformUtilsService,
      this.vaultTimeoutSettingsService,
      this.environmentService,
    );

    const peer = new SharedUnlockPeer(this.ipcService.client, sharedUnlockDriver);
    this.peer = peer;
    await peer.start();

    this.accountService.accounts$
      .pipe(concatMap((accounts) => this.syncAccounts(Object.keys(accounts) as UserId[])))
      .subscribe();

    this.lockService.registerOnLockAction(async (userId, source) => {
      // A peer locked us. Announcing it back would send it around the hierarchy again.
      if (source === LockSource.SharedUnlock) {
        return;
      }

      await peer.handle_device_event({
        ManualLock: {
          user_id: asUuid(userId),
        },
      });
    });

    this.unlockService.registerOnUnlockAction(async (userId, userKey, method) => {
      // A peer handed us this unlock. Announcing it back would send it around the hierarchy again.
      if (method === UnlockMethod.SharedUnlock) {
        return;
      }

      await peer.handle_device_event({
        ManualUnlock: {
          user_id: asUuid(userId),
          user_key: userKey.toSdk(),
        },
      });
    });
  }

  /**
   * Starts watching the destinations of accounts seen for the first time, and stops watching
   * accounts that are gone.
   */
  private async syncAccounts(userIds: UserId[]): Promise<void> {
    for (const userId of userIds) {
      if (this.destinationSubscriptions.has(userId)) {
        continue;
      }

      await this.writeExplicitSettings(userId);
      this.destinationSubscriptions.set(userId, this.watchDestinations(userId));
    }

    for (const [userId, subscription] of this.destinationSubscriptions) {
      if (userIds.includes(userId)) {
        continue;
      }

      subscription.unsubscribe();
      this.destinationSubscriptions.delete(userId);
    }
  }

  /**
   * Writes the account's sharing settings to state, so they hold an explicit value instead of an
   * implicit default.
   */
  private async writeExplicitSettings(userId: UserId): Promise<void> {
    const allowDesktop = await firstValueFrom(
      this.sharedUnlockSettingsService.allowSharingUnlockStateWithDesktop$(userId),
    );
    await this.sharedUnlockSettingsService.setAllowSharingUnlockStateWithDesktop(
      allowDesktop,
      userId,
    );

    const allowWeb = await firstValueFrom(
      this.sharedUnlockSettingsService.allowSharingUnlockStateWithWeb$(userId),
    );
    await this.sharedUnlockSettingsService.setAllowSharingUnlockStateWithWeb(allowWeb, userId);
  }

  /**
   * Keeps the peer's destinations for the account in sync with the settings they derive from.
   * Deriving instead of pushing on write covers settings written elsewhere (the
   * login-decryption-options screen), a mid-session feature flag flip, and the reset to defaults on
   * logout.
   */
  private watchDestinations(userId: UserId): Subscription {
    return this.destinations$(userId)
      .pipe(distinctUntilChanged(sameDestinations))
      .subscribe((destinations) => this.peer?.set_destinations(asUuid(userId), destinations));
  }

  /**
   * The clients this peer shares the user's unlock state with.
   *
   *   browser  ->  desktop and/or web, per the user's settings
   *   desktop  ->  browser
   *   web      ->  browser
   */
  private destinations$(userId: UserId): Observable<SharedUnlockClient[]> {
    return combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.SharedUnlockPart2),
      this.sharedUnlockSettingsService.unlockSharingDisabled$(userId),
      this.sharedUnlockSettingsService.allowSharingUnlockStateWithDesktop$(userId),
      this.sharedUnlockSettingsService.allowSharingUnlockStateWithWeb$(userId),
    ]).pipe(
      map(([featureEnabled, sharingDisabled, allowDesktop, allowWeb]) => {
        if (!featureEnabled || sharingDisabled) {
          return NO_DESTINATIONS;
        }

        if (this.platformUtilsService.getClientType() !== ClientType.Browser) {
          return BROWSER_ONLY;
        }

        const destinations: SharedUnlockClient[] = [];
        if (allowDesktop) {
          destinations.push("Desktop");
        }
        if (allowWeb) {
          destinations.push("Web");
        }

        return destinations;
      }),
    );
  }
}
