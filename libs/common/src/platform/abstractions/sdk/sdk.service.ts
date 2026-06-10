import { Observable } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { EncString } from "@bitwarden/legacy-crypto";
import {
  PasswordManagerClient,
  Uuid,
  DeviceType as SdkDeviceType,
  InitUserCryptoRequest,
} from "@bitwarden/sdk-internal";

import { DeviceType } from "../../../enums";
import { OrganizationId, UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { Rc } from "../../misc/reference-counting/rc";
import { Utils } from "../../misc/utils";

/**
 * The caller-supplied half of an {@link SdkService.unlock} request.
 *
 * `email`, `kdfParams` and `upgradeToken` are omitted because this service resolves them itself. They are
 * account-scoped facts rather than unlock inputs, so every caller would otherwise resolve the same three
 * values from the same sources, and a caller that forgot one would silently change how the client unlocks.
 * `userId` identifies the account and `method` selects how it unlocks: `decryptedKey` when the caller already
 * holds the key, or a credential variant (master password, PIN, biometrics, …) when it does not.
 */
export type SdkUnlockRequest = Omit<InitUserCryptoRequest, "email" | "kdfParams" | "upgradeToken">;

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
   * Initialize (or re-initialize) user and org crypto on the user's existing client, whether the caller
   * holds the derived key already (`method: decryptedKey`) or is unlocking from a credential (master
   * password, PIN, biometrics, …). Running the credential unlock here rather than on a throwaway register
   * client is what makes the client that derives the key and writes `USER_KEY` the same one consumers read
   * through {@link userClient$}, closing the window where a consumer could read `USER_KEY` and query a
   * still-locked client.
   *
   * This initializes **user** crypto only. Organization keys always follow through {@link setOrgKeys}, which
   * is what completes the unlock and flips {@link cryptoReady$}. Splitting it that way is not a preference:
   * the credential paths cannot build organization keys until the user key exists, so one of the two callers
   * has to defer, and having both defer means one rule instead of two.
   *
   * Returns the {@link UserKey} the client is now unlocked with, so a credential caller can run its unlock
   * side effects (biometric / auto-unlock storage, org keys) without re-deriving it. `null` signals one
   * thing only — the flag is off — and tells a credential caller to fall back to the legacy register-client
   * unlock. A failure to unlock throws, since falling back on failure would land the caller on the very
   * path this replaces.
   */
  abstract unlock(userId: UserId, request: SdkUnlockRequest): Promise<UserKey | null>;

  /**
   * Whether the user's client can decrypt: user crypto is initialized **and** organization keys have been
   * applied. Consumers that trigger decryption must gate on this rather than on `USER_KEY` appearing in
   * state, because the SDK writes `USER_KEY` from inside its own unlock, before organization keys exist.
   * A consumer keyed on state alone starts decrypting against a client that fails every organization
   * cipher with "Missing Key for Id: Organization".
   *
   * Emits `false` from the start of an {@link unlock} until {@link setOrgKeys} completes it, and on
   * {@link lock} and {@link logout}. Always `true` while the rollout flag is off, where the reactive path
   * rebuilds the client from the same state the consumers read.
   *
   * An unlock that never reaches {@link setOrgKeys} leaves this `false` forever and the vault undecryptable.
   * That is deliberate: it fails loudly rather than decrypting against a half-initialized client.
   */
  abstract cryptoReady$(userId: UserId): Observable<boolean>;

  /**
   * Clear the in-memory user key by disposing the unlocked client and replacing it with a token-only,
   * key-cleared client. Called by the lock flow.
   */
  abstract lock(userId: UserId): Promise<void>;

  /** Dispose the user's client and complete its {@link userClient$}. Called by the logout flow. */
  abstract logout(userId: UserId): void;

  /** Apply feature flags to the user's live client. Called by the config service. */
  abstract setFlags(userId: UserId, flags: Map<string, boolean>): Promise<void>;

  /**
   * Apply organization keys to the user's live client, completing an {@link unlock} and flipping
   * {@link cryptoReady$} true. Every unlock path must reach this, including for a user with no
   * organizations, where `{}` is the correct payload.
   */
  abstract setOrgKeys(userId: UserId, orgKeys: Record<OrganizationId, EncString>): Promise<void>;
}
