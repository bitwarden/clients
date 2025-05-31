import { inject, Injectable } from "@angular/core";
import { map, Observable, shareReplay } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  GlobalStateProvider,
  KeyDefinition,
  VAULT_APPEARANCE,
} from "@bitwarden/common/platform/state";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

export type CopyButtonDisplayMode = "combined" | "quick";

type CipherItem = {
  value: string;
  key: string;
  field?: string;
};

type CopyButtonsView = {
  hasLoginValues: boolean;
  hasCardValues: boolean;
  hasIdentityValues: boolean;
  hasSecureNoteValue: boolean;
  hasSshKeyValues: boolean;
  singleCopiableLogin: CipherItem | null;
  singleCopiableCard: CipherItem | null;
  singleCopiableIdentity: CipherItem | null;
};

const COPY_BUTTON = new KeyDefinition<CopyButtonDisplayMode>(VAULT_APPEARANCE, "copyButtons", {
  deserializer: (s) => s,
});

/**
 * Settings service for vault copy button settings
 **/
@Injectable({ providedIn: "root" })
export class VaultPopupCopyButtonsService {
  private readonly DEFAULT_DISPLAY_MODE = "combined";
  private state = inject(GlobalStateProvider).get(COPY_BUTTON);
  private i18nService = inject(I18nService);

  displayMode$: Observable<CopyButtonDisplayMode> = this.state.state$.pipe(
    map((state) => state ?? this.DEFAULT_DISPLAY_MODE),
  );

  async setDisplayMode(displayMode: CopyButtonDisplayMode) {
    await this.state.update(() => displayMode);
  }

  showQuickCopyActions$: Observable<boolean> = this.displayMode$.pipe(
    map((displayMode) => displayMode === "quick"),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  async setShowQuickCopyActions(value: boolean) {
    await this.setDisplayMode(value ? "quick" : "combined");
  }

  toCopyButtonsView(cipher: CipherView): CopyButtonsView {
    return {
      hasLoginValues: this.hasLoginValues(cipher),
      hasCardValues: this.hasCardValues(cipher),
      hasIdentityValues: this.hasIdentityValues(cipher),
      hasSecureNoteValue: this.hasSecureNoteValue(cipher),
      hasSshKeyValues: this.hasSshKeyValues(cipher),
      singleCopiableLogin: this.singleCopiableLogin(cipher),
      singleCopiableCard: this.singleCopiableCard(cipher),
      singleCopiableIdentity: this.singleCopiableIdentity(cipher),
    };
  }

  private hasLoginValues(cipher: CipherView) {
    return !!cipher.login.hasTotp || !!cipher.login.password || !!cipher.login.username;
  }

  /*
   * singleCopiableLogin uses appCopyField instead of appCopyClick. This allows for the TOTP
   * code to be copied correctly. See #14167
   */
  private singleCopiableLogin(cipher: CipherView) {
    const loginItems: CipherItem[] = [
      { value: cipher.login.username, key: "copyUsername", field: "username" },
      { value: cipher.login.password, key: "copyPassword", field: "password" },
      { value: cipher.login.totp, key: "copyVerificationCode", field: "totp" },
    ];
    // If both the password and username are visible but the password is hidden, return the username
    if (!cipher.viewPassword && cipher.login.username && cipher.login.password) {
      return {
        value: cipher.login.username,
        key: this.i18nService.t("copyUsername"),
        field: "username",
      };
    }
    return this.findSingleCopiableItem(loginItems);
  }

  private singleCopiableCard(cipher: CipherView) {
    const cardItems: CipherItem[] = [
      { value: cipher.card.code, key: "code" },
      { value: cipher.card.number, key: "number" },
    ];
    return this.findSingleCopiableItem(cardItems);
  }

  private singleCopiableIdentity(cipher: CipherView) {
    const identityItems: CipherItem[] = [
      { value: cipher.identity.fullAddressForCopy, key: "address" },
      { value: cipher.identity.email, key: "email" },
      { value: cipher.identity.username, key: "username" },
      { value: cipher.identity.phone, key: "phone" },
    ];
    return this.findSingleCopiableItem(identityItems);
  }

  /*
   * Given a list of CipherItems, if there is only one item with a value,
   * return it with the translated key. Otherwise return null
   */
  findSingleCopiableItem(items: CipherItem[]): CipherItem | null {
    const itemsWithValue = items.filter(({ value }) => !!value);
    return itemsWithValue.length === 1
      ? { ...itemsWithValue[0], key: this.i18nService.t(itemsWithValue[0].key) }
      : null;
  }

  private hasCardValues(cipher: CipherView) {
    return !!cipher.card.code || !!cipher.card.number;
  }

  private hasIdentityValues(cipher: CipherView) {
    return (
      !!cipher.identity.fullAddressForCopy ||
      !!cipher.identity.email ||
      !!cipher.identity.username ||
      !!cipher.identity.phone
    );
  }

  private hasSecureNoteValue(cipher: CipherView) {
    return !!cipher.notes;
  }

  private hasSshKeyValues(cipher: CipherView) {
    return (
      !!cipher.sshKey.privateKey || !!cipher.sshKey.publicKey || !!cipher.sshKey.keyFingerprint
    );
  }
}
