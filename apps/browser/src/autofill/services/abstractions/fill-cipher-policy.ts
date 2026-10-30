import { Observable } from "rxjs";

import { UriMatchStrategySetting } from "@bitwarden/common/models/domain/domain-service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

/** Why Autofill looks up ciphers. A policy can give each use a different set of ciphers. */
export const CipherUse = Object.freeze({
  /** The user picked a cipher or ran a command: inline menu, context menu, keyboard shortcut, popup fill. */
  UserFill: "userFill",
  /** Bitwarden starts the fill: page-load fill, auto-submit, HTTP basic auth. */
  AutomaticFill: "automaticFill",
  /** An add or update prompt: match the submitted form, show the ciphers in the prompt. */
  SavePrompt: "savePrompt",
  /** At-risk password tasks for the URL. */
  SecurityTask: "securityTask",
  /** Passkey registration and selection. */
  Passkey: "passkey",
  /** The toolbar badge count. */
  Badge: "badge",
} as const);
export type CipherUse = (typeof CipherUse)[keyof typeof CipherUse];

/** The login form Autofill would offer to save. */
export type SaveCandidate = {
  uri: string;
  username?: string;
  password?: string;
  newPassword?: string;
};

/** The ciphers Autofill may use. Every cipher lookup in Autofill goes through it. */
export abstract class FillCipherPolicy {
  /** Emits when a lookup result can change. A cached result must recompute. */
  abstract changed$(userId: UserId): Observable<void>;
  abstract ciphers(userId: UserId, use: CipherUse): Promise<CipherView[]>;
  abstract ciphersForUrl(
    url: string,
    userId: UserId,
    use: CipherUse,
    options?: { includeOtherTypes?: CipherType[]; defaultMatch?: UriMatchStrategySetting },
  ): Promise<CipherView[]>;
  /** For automatic fills. */
  abstract lastLaunchedForUrl(
    url: string,
    userId: UserId,
    autofillOnPageLoad: boolean,
  ): Promise<CipherView | undefined>;
  /** For automatic fills. */
  abstract lastUsedForUrl(
    url: string,
    userId: UserId,
    autofillOnPageLoad: boolean,
  ): Promise<CipherView | undefined>;
  /** The next cipher in the keyboard shortcut rotation. Always a user fill. */
  abstract nextCipherForUrl(url: string, userId: UserId): Promise<CipherView | undefined>;
  /** The next card in the card keyboard shortcut rotation. Always a user fill. */
  abstract nextCardCipher(userId: UserId): Promise<CipherView | undefined>;
  /** The next identity in the identity keyboard shortcut rotation. Always a user fill. */
  abstract nextIdentityCipher(userId: UserId): Promise<CipherView | undefined>;
  abstract advanceRotation(url: string): void;
  /**
   * False when Autofill must not copy this form into a new or updated cipher. Call it before a
   * save prompt, before a save, and before a draft that takes values from the page.
   */
  abstract canOfferSave(form: SaveCandidate, userId: UserId): Promise<boolean>;
}
