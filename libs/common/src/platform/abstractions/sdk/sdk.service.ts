import { Observable } from "rxjs";

import { DeviceType } from "@bitwarden/common/enums";
import { BitwardenClient, Uuid, DeviceType as SdkDeviceType } from "@bitwarden/sdk-internal";

import { UserId } from "../../../types/guid";
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

export abstract class SdkService {
  /**
   * Retrieve the version of the SDK.
   */
  abstract version$: Observable<string>;

  /**
   * Retrieve a client initialized without a user.
   * This client can only be used for operations that don't require a user context.
   */
  abstract client$: Observable<BitwardenClient>;

  /**
   * Retrieve a client initialized for a specific user.
   * This client can be used for operations that require a user context, such as retrieving ciphers
   * and operations involving crypto. It can also be used for operations that don't require a user context.
   *
   *   - If the user is not logged when the subscription is created, the observable will complete
   *     immediately with {@link UserNotLoggedInError}.
   *   - If the user is logged in, the observable will emit the client and complete whithout an error
   *     when the user logs out.
   *
   * **WARNING:** Do not use `firstValueFrom(userClient$)`! Any operations on the client must be done within the observable.
   * The client will be destroyed when the observable is no longer subscribed to.
   * Please let platform know if you need a client that is not destroyed when the observable is no longer subscribed to.
   *
   * @param userId The user id for which to retrieve the client
   */
  abstract userClient$(userId: UserId): Observable<Rc<BitwardenClient>>;

  /**
   * This method is used during/after an authentication procedure to set a new client for a specific user.
   * It can also be used to unset the client when a user logs out, this will result in:
   *  - The client being disposed of
   *  - All subscriptions to the client being completed
   *  - Any new subscribers receiving an error
   * @param userId The user id for which to set the client
   * @param client The client to set for the user. If undefined, the client will be unset.
   */
  abstract setClient(userId: UserId, client: BitwardenClient | undefined): void;
}
