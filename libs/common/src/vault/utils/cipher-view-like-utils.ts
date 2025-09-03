import {
  UriMatchStrategy,
  UriMatchStrategySetting,
} from "@bitwarden/common/models/domain/domain-service";
import {
  CardListView,
  CipherListView,
  CopyableCipherFields,
  LoginListView,
  LoginUriView as LoginListUriView,
} from "@bitwarden/sdk-internal";

import { CipherType } from "../enums";
import { Cipher } from "../models/domain/cipher";
import { CardView } from "../models/view/card.view";
import { CipherView } from "../models/view/cipher.view";
import { LoginUriView } from "../models/view/login-uri.view";
import { LoginView } from "../models/view/login.view";

/**
 * Type union of {@link CipherView} and {@link CipherListView}.
 */
export type CipherViewLike = CipherView | CipherListView;

/**
 * Utility class for working with ciphers that can be either a {@link CipherView} or a {@link CipherListView}.
 */
export class CipherViewLikeUtils {
  /** @returns true when the given cipher is an instance of {@link CipherListView}. */
  static isCipherListView = (cipher: CipherViewLike | Cipher): cipher is CipherListView => {
    return typeof cipher.type === "object" || typeof cipher.type === "string";
  };

  /** @returns The login object from the input cipher. If the cipher is not of type Login, returns null. */
  static getLogin = (cipher: CipherViewLike): LoginListView | LoginView | null => {
    if (this.isCipherListView(cipher)) {
      if (typeof cipher.type !== "object") {
        return null;
      }

      return "login" in cipher.type ? cipher.type.login : null;
    }

    return cipher.type === CipherType.Login ? cipher.login : null;
  };

  /** @returns The first URI for a login cipher. If the cipher is not of type Login or has no associated URIs, returns null. */
  static uri = (cipher: CipherViewLike) => {
    const login = this.getLogin(cipher);
    if (!login) {
      return null;
    }

    if ("uri" in login) {
      return login.uri;
    }

    return login.uris?.length ? login.uris[0].uri : null;
  };

  /** @returns The login object from the input cipher. If the cipher is not of type Login, returns null. */
  static getCard = (cipher: CipherViewLike): CardListView | CardView | null => {
    if (this.isCipherListView(cipher)) {
      if (typeof cipher.type !== "object") {
        return null;
      }

      return "card" in cipher.type ? cipher.type.card : null;
    }

    return cipher.type === CipherType.Card ? cipher.card : null;
  };

  /**  @returns `true` when the cipher has been deleted, `false` otherwise. */
  static isDeleted = (cipher: CipherViewLike): boolean => {
    if (this.isCipherListView(cipher)) {
      return !!cipher.deletedDate;
    }

    return cipher.isDeleted;
  };

  /**  @returns `true` when the cipher is not assigned to a collection, `false` otherwise. */
  static isUnassigned = (cipher: CipherViewLike): boolean => {
    if (this.isCipherListView(cipher)) {
      return (
        cipher.organizationId != null &&
        (cipher.collectionIds == null || cipher.collectionIds.length === 0)
      );
    }

    return cipher.isUnassigned;
  };

  /** @returns `true` when the user can assign the cipher to a collection, `false` otherwise. */
  static canAssignToCollections = (cipher: CipherViewLike): boolean => {
    if (this.isCipherListView(cipher)) {
      if (!cipher.organizationId) {
        return true;
      }

      return cipher.edit && cipher.viewPassword;
    }

    return cipher.canAssignToCollections;
  };

  /**
   * Returns the type of the cipher.
   * For consistency, when the given cipher is a {@link CipherListView} the {@link CipherType} equivalent will be returned.
   */
  static getType = (cipher: CipherViewLike | Cipher): CipherType => {
    if (!this.isCipherListView(cipher)) {
      return cipher.type;
    }

    // CipherListViewType is a string, so we need to map it to CipherType.
    switch (true) {
      case cipher.type === "secureNote":
        return CipherType.SecureNote;
      case cipher.type === "sshKey":
        return CipherType.SshKey;
      case cipher.type === "identity":
        return CipherType.Identity;
      case typeof cipher.type === "object" && "card" in cipher.type:
        return CipherType.Card;
      case typeof cipher.type === "object" && "login" in cipher.type:
        return CipherType.Login;
      default:
        throw new Error(`Unknown cipher type: ${cipher.type}`);
    }
  };

  /** @returns The subtitle of the cipher. */
  static subtitle = (cipher: CipherViewLike): string | undefined => {
    if (!this.isCipherListView(cipher)) {
      return cipher.subTitle;
    }

    return cipher.subtitle;
  };

  /** @returns `true` when the cipher has attachments, false otherwise. */
  static hasAttachments = (cipher: CipherViewLike): boolean => {
    if (this.isCipherListView(cipher)) {
      return typeof cipher.attachments === "number" && cipher.attachments > 0;
    }

    return cipher.hasAttachments;
  };

  /**
   * @returns `true` when one of the URIs for the cipher can be launched.
   * When a non-login cipher is passed, it will return false.
   */
  static canLaunch = (cipher: CipherViewLike): boolean => {
    const login = this.getLogin(cipher);

    if (!login) {
      return false;
    }

    return !!login.uris?.map((u) => toLoginUriView(u)).some((uri) => uri.canLaunch);
  };

  /**
   * @returns The first launch-able URI for the cipher.
   * When a non-login cipher is passed or none of the URLs, it will return undefined.
   */
  static getLaunchUri = (cipher: CipherViewLike): string | undefined => {
    const login = this.getLogin(cipher);

    if (!login) {
      return undefined;
    }

    return login.uris?.map((u) => toLoginUriView(u)).find((uri) => uri.canLaunch)?.launchUri;
  };

  /**
   * @returns `true` when the `targetUri` matches for any URI on the cipher.
   * Uses the existing logic from `LoginView.matchesUri` for both `CipherView` and `CipherListView`
   */
  static matchesUri = (
    cipher: CipherViewLike,
    targetUri: string,
    equivalentDomains: Set<string>,
    defaultUriMatch: UriMatchStrategySetting = UriMatchStrategy.Domain,
  ): boolean => {
    if (CipherViewLikeUtils.getType(cipher) !== CipherType.Login) {
      return false;
    }

    if (!this.isCipherListView(cipher)) {
      return cipher.login.matchesUri(targetUri, equivalentDomains, defaultUriMatch);
    }

    const login = this.getLogin(cipher);
    if (!login?.uris?.length) {
      return false;
    }

    const loginUriViews = login.uris
      .filter((u) => !!u.uri)
      .map((u) => {
        const view = new LoginUriView();
        view.match = u.match ?? defaultUriMatch;
        view.uri = u.uri!; // above `filter` ensures `u.uri` is not null or undefined
        return view;
      });

    return loginUriViews.some((uriView) =>
      uriView.matchesUri(targetUri, equivalentDomains, defaultUriMatch),
    );
  };

  /** @returns true when the `copyField` is populated on the given cipher. */
  static hasCopyableValue = (cipher: CipherViewLike, copyField: string): boolean => {
    // `CipherListView` instances do not contain the values to be copied, but rather a list of copyable fields.
    // When the copy action is performed on a `CipherListView`, the full cipher will need to be decrypted.
    if (this.isCipherListView(cipher)) {
      let _copyField = copyField;

      if (_copyField === "username" && this.getType(cipher) === CipherType.Login) {
        _copyField = "usernameLogin";
      } else if (_copyField === "username" && this.getType(cipher) === CipherType.Identity) {
        _copyField = "usernameIdentity";
      }

      return cipher.copyableFields.includes(copyActionToCopyableFieldMap[_copyField]);
    }

    // When the full cipher is available, check the specific field
    switch (copyField) {
      case "username":
        return !!cipher.login?.username || !!cipher.identity?.username;
      case "password":
        return !!cipher.login?.password;
      case "totp":
        return !!cipher.login?.totp;
      case "cardNumber":
        return !!cipher.card?.number;
      case "securityCode":
        return !!cipher.card?.code;
      case "email":
        return !!cipher.identity?.email;
      case "phone":
        return !!cipher.identity?.phone;
      case "address":
        return !!cipher.identity?.fullAddressForCopy;
      case "secureNote":
        return !!cipher.notes;
      case "privateKey":
        return !!cipher.sshKey?.privateKey;
      case "publicKey":
        return !!cipher.sshKey?.publicKey;
      case "keyFingerprint":
        return !!cipher.sshKey?.keyFingerprint;
      default:
        return false;
    }
  };

  /** @returns true when the cipher has fido2 credentials */
  static hasFido2Credentials = (cipher: CipherViewLike): boolean => {
    const login = this.getLogin(cipher);

    return !!login?.fido2Credentials?.length;
  };

  /**
   * Returns the `decryptionFailure` property from the cipher when available.
   * TODO: https://bitwarden.atlassian.net/browse/PM-22515 - alter for `CipherListView` if needed
   */
  static decryptionFailure = (cipher: CipherViewLike): boolean => {
    return "decryptionFailure" in cipher ? cipher.decryptionFailure : false;
  };
}

/**
 * Mapping between the generic copy actions and the specific fields in a `CipherViewLike`.
 */
const copyActionToCopyableFieldMap: Record<string, CopyableCipherFields> = {
  usernameLogin: "LoginUsername",
  password: "LoginPassword",
  totp: "LoginTotp",
  cardNumber: "CardNumber",
  securityCode: "CardSecurityCode",
  usernameIdentity: "IdentityUsername",
  email: "IdentityEmail",
  phone: "IdentityPhone",
  address: "IdentityAddress",
  secureNote: "SecureNotes",
  privateKey: "SshKey",
  publicKey: "SshKey",
  keyFingerprint: "SshKey",
};

/** Converts a `LoginListUriView` to a `LoginUriView`. */
const toLoginUriView = (uri: LoginListUriView | LoginUriView): LoginUriView => {
  if (uri instanceof LoginUriView) {
    return uri;
  }

  const loginUriView = new LoginUriView();
  if (uri.match) {
    loginUriView.match = uri.match;
  }
  if (uri.uri) {
    loginUriView.uri = uri.uri;
  }
  return loginUriView;
};
