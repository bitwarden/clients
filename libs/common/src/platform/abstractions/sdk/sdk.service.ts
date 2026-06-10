import { Observable } from "rxjs";

import {
  PasswordManagerClient,
  Uuid,
  DeviceType as SdkDeviceType,
  Kdf,
  WrappedAccountCryptographicState,
} from "@bitwarden/sdk-internal";

import { DeviceType } from "../../../enums";
import { EncString } from "../../../key-management/crypto/models/enc-string";
import { OrganizationId, UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { Rc } from "../../misc/reference-counting/rc";
import { Utils } from "../../misc/utils";

/**
 * The data needed to initialize user crypto on an existing client, pushed by the unlock flow.
 */
export interface SdkUnlockData {
  userKey: UserKey;
  email: string;
  kdf: Kdf;
  accountCryptographicState: WrappedAccountCryptographicState;
  orgKeys: Record<OrganizationId, EncString>;
}

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
   *   - If the user is not logged in when the subscription is created, the observable will complete
   *     immediately with {@link UserNotLoggedInError}.
   *   - If the user is logged in, the observable will emit the client and complete without an error
   *     when the user logs out. The returned client MAY be locked or unlocked depending on the state
   *     of the user.
   *
   * The client is long-lived (bound to the user session), so it is safe to take a reference and use
   * it across operations. The returned {@link Rc} guards against disposal while a reference is held.
   *
   * @param userId The user id for which to retrieve the client
   */
  abstract userClient$(userId: UserId): Observable<Rc<PasswordManagerClient>>;

  /**
   * Initialize (or re-initialize) user and org crypto on the user's existing client. Called by the
   * unlock flow, which supplies the decrypted key and the rest of the crypto payload.
   */
  abstract unlock(userId: UserId, data: SdkUnlockData): Promise<void>;

  /**
   * Clear the in-memory user key by disposing the unlocked client and replacing it with a token-only,
   * key-cleared client. Called by the lock flow.
   */
  abstract lock(userId: UserId): Promise<void>;

  /** Dispose the user's client and complete its {@link userClient$}. Called by the logout flow. */
  abstract logout(userId: UserId): void;

  /** Apply feature flags to the user's live client. Called by the config service. */
  abstract setFlags(userId: UserId, flags: Map<string, boolean>): Promise<void>;

  /** Apply organization keys to the user's live client. Called by the key service. */
  abstract setOrgKeys(userId: UserId, orgKeys: Record<OrganizationId, EncString>): Promise<void>;
}
