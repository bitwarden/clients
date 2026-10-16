import { Observable } from "rxjs";

import {
  InitUserCryptoRequest,
  PasswordManagerClient,
  Uuid,
  DeviceType as SdkDeviceType,
  UnsignedSharedKey,
} from "@bitwarden/sdk-internal";

import { DeviceType } from "../../../enums";
import { OrganizationId, UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { Rc } from "../../misc/reference-counting/rc";
import { Utils } from "../../misc/utils";

export class UserNotLoggedInError extends Error {
  constructor(userId: UserId) {
    super(`User (${userId}) is not logged in`);
  }
}

export class InvalidUuid extends Error {
  constructor(uuid: string) {
    super(`Invalid UUID: ${uuid}`);
  }
}

export function toSdkDevice(device: DeviceType): SdkDeviceType {
  switch (device) {
    case DeviceType.Android:
      return "Android";
    case DeviceType.iOS:
      return "iOS";
    case DeviceType.ChromeExtension:
      return "ChromeExtension";
    case DeviceType.FirefoxExtension:
      return "FirefoxExtension";
    case DeviceType.OperaExtension:
      return "OperaExtension";
    case DeviceType.EdgeExtension:
      return "EdgeExtension";
    case DeviceType.WindowsDesktop:
      return "WindowsDesktop";
    case DeviceType.MacOsDesktop:
      return "MacOsDesktop";
    case DeviceType.LinuxDesktop:
      return "LinuxDesktop";
    case DeviceType.ChromeBrowser:
      return "ChromeBrowser";
    case DeviceType.FirefoxBrowser:
      return "FirefoxBrowser";
    case DeviceType.OperaBrowser:
      return "OperaBrowser";
    case DeviceType.EdgeBrowser:
      return "EdgeBrowser";
    case DeviceType.IEBrowser:
      return "IEBrowser";
    case DeviceType.UnknownBrowser:
      return "UnknownBrowser";
    case DeviceType.AndroidAmazon:
      return "AndroidAmazon";
    case DeviceType.UWP:
      return "UWP";
    case DeviceType.SafariBrowser:
      return "SafariBrowser";
    case DeviceType.VivaldiBrowser:
      return "VivaldiBrowser";
    case DeviceType.VivaldiExtension:
      return "VivaldiExtension";
    case DeviceType.SafariExtension:
      return "SafariExtension";
    case DeviceType.Server:
      return "Server";
    case DeviceType.WindowsCLI:
      return "WindowsCLI";
    case DeviceType.MacOsCLI:
      return "MacOsCLI";
    case DeviceType.LinuxCLI:
      return "LinuxCLI";
    default:
      return "SDK";
  }
}

/**
 * Converts a string to UUID. Will throw an error if the UUID is non valid.
 */
export function asUuid<T extends Uuid>(uuid: string): T {
  if (Utils.isGuid(uuid)) {
    return uuid as T;
  }

  throw new InvalidUuid(uuid);
}

/**
 * Converts a UUID to the string representation.
 */
export function uuidAsString<T extends Uuid>(uuid: T): string {
  return uuid as unknown as string;
}

/**
 * The data needed to unlock a user's SDK client.
 */
export type SdkUnlockRequest = Omit<InitUserCryptoRequest, "email" | "kdfParams" | "upgradeToken">;

export abstract class SdkService {
  /**
   * Retrieve the version of the SDK.
   */
  abstract version$: Observable<string>;

  /**
   * Retrieve a client initialized without a user.
   * This client can only be used for operations that don't require a user context.
   */
  abstract client$: Observable<PasswordManagerClient>;

  /**
   * Retrieve a client initialized for a specific user.
   * This client can be used for operations that require a user context, such as retrieving ciphers
   * and operations involving crypto. It can also be used for operations that don't require a user context.
   *
   *   - If the user is not logged when the subscription is created, the observable will complete
   *     immediately with {@link UserNotLoggedInError}.
   *   - If the user is logged in, the observable will emit the client and complete without an error
   *     when the user logs out. The returned client MAY be locked or unlocked depending on the state
   *     of the user.
   *
   * **WARNING:** Do not use `firstValueFrom(userClient$)`! Any operations on the client must be done within the observable.
   * The client will be destroyed when the observable is no longer subscribed to.
   * Please let platform know if you need a client that is not destroyed when the observable is no longer subscribed to.
   *
   * @param userId The user id for which to retrieve the client
   */
  abstract userClient$(userId: UserId): Observable<Rc<PasswordManagerClient>>;

  /**
   * Unlock the user's live client.
   * @param userId The user whose client to unlock
   * @param request The data needed to unlock the client
   * @returns The user key, or `null` if no client was unlocked
   */
  abstract unlock(userId: UserId, request: SdkUnlockRequest): Promise<UserKey | null>;

  /**
   * Clear the in-memory user key (lock).
   * @param userId The user whose client to lock
   */
  abstract lock(userId: UserId): Promise<void>;

  /**
   * Dispose the user's client and complete its `userClient$` (logout).
   * @param userId The user whose client to dispose
   */
  abstract logout(userId: UserId): void;

  /**
   * Apply feature flags to the user's live client.
   * @param userId The user whose client to update
   * @param flags The feature flags to apply
   */
  abstract setFlags(userId: UserId, flags: Map<string, boolean>): Promise<void>;

  /**
   * Apply organization keys to the user's live client.
   * @param userId The user whose client to update
   * @param orgKeys The organization keys, each encapsulated to the user's public key
   */
  abstract setOrgKeys(
    userId: UserId,
    orgKeys: Record<OrganizationId, UnsignedSharedKey>,
  ): Promise<void>;
}
