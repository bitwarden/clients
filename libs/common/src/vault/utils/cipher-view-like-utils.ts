import { SafeUrls } from "@bitwarden/common/platform/misc/safe-urls";
import { CipherListView } from "@bitwarden/sdk-internal";

import { CipherType } from "../enums";
import { CipherView } from "../models/view/cipher.view";

/**
 * Type union of {@link CipherView} and {@link CipherListView}.
 */
export type CipherViewLike = CipherView | CipherListView;

/**
 * Utility class for working with ciphers that can be either a {@link CipherView} or a {@link CipherListView}.
 */
export class CipherViewLikeUtils {
  /** @returns true when the given cipher is an instance of {@link CipherListView}. */
  static isCipherListView = (cipher: CipherViewLike): cipher is CipherListView => {
    return typeof cipher.type !== "number";
  };

  /** @returns The login object from the input cipher. If the cipher is not of type Login, returns null. */
  static getCipherViewLikeLogin = (cipher: CipherViewLike) => {
    if (this.isCipherListView(cipher)) {
      if (typeof cipher.type !== "object") {
        return null;
      }

      return cipher.type.login;
    }

    return cipher.type === CipherType.Login ? cipher.login : null;
  };

  /** @returns The first URI for a login cipher. If the cipher is not of type Login or has no associated URIs, returns null. */
  static uri = (cipher: CipherViewLike) => {
    const login = this.getCipherViewLikeLogin(cipher);
    if (!login) {
      return null;
    }

    if ("uri" in login) {
      return login.uri;
    }

    return login.uris?.length ? login.uris[0].uri : null;
  };

  /**  @returns `true` when the cipher has been deleted, `false` otherwise. */
  static isDeleted = (cipher: CipherViewLike): boolean => {
    if (this.isCipherListView(cipher)) {
      return !!cipher.deletedDate;
    }

    return cipher.isDeleted;
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
  static getType = (cipher: CipherViewLike): CipherType => {
    if (!this.isCipherListView(cipher)) {
      return cipher.type;
    }

    // CipherListViewType is a string, so we need to map it to CipherType.
    switch (cipher.type) {
      case "secureNote":
        return CipherType.SecureNote;
      case "card":
        return CipherType.Card;
      case "identity":
        return CipherType.Identity;
      case "sshKey":
        return CipherType.SshKey;
      default:
        return CipherType.Login;
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
    const login = this.getCipherViewLikeLogin(cipher);

    if (!login) {
      return false;
    }

    return !!login.uris?.map((u) => u.uri).some((uri) => uri && SafeUrls.canLaunch(uri));
  };

  /**
   * @returns The first launch-able URI for the cipher.
   * When a non-login cipher is passed or none of the URLs, it will return undefined.
   */
  static getLaunchUri = (cipher: CipherViewLike): string | undefined => {
    const login = this.getCipherViewLikeLogin(cipher);

    if (!login) {
      return undefined;
    }

    return login.uris?.map((u) => u.uri).find((uri) => uri && SafeUrls.canLaunch(uri));
  };
}
