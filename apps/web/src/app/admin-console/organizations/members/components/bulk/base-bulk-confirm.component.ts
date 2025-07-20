// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, OnInit } from "@angular/core";

import {
  OrganizationUserBulkPublicKeyResponse,
  OrganizationUserBulkResponse,
} from "@bitwarden/admin-console/common";
import { ProviderUserBulkPublicKeyResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user-bulk-public-key.response";
import { ProviderUserBulkResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user-bulk.response";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { KeyService } from "@bitwarden/key-management";

import { BulkUserDetails } from "./bulk-status.component";

@Directive()
export abstract class BaseBulkConfirmComponent implements OnInit {
  protected users: BulkUserDetails[];

  protected excludedUsers: BulkUserDetails[];
  protected filteredUsers: BulkUserDetails[];

  protected publicKeys: Map<string, Uint8Array> = new Map();
  protected fingerprints: Map<string, string> = new Map();
  protected statuses: Map<string, string> = new Map();

  protected done = false;
  protected loading = true;
  protected error: string;

  protected constructor(
    protected keyService: KeyService,
    protected encryptService: EncryptService,
    protected i18nService: I18nService,
  ) {}

  async ngOnInit() {
    this.excludedUsers = this.users.filter((user) => !this.isAccepted(user));
    this.filteredUsers = this.users.filter((user) => this.isAccepted(user));

    if (this.filteredUsers.length <= 0) {
      this.done = true;
    }

    const publicKeysResponse = await this.getPublicKeys();

    for (const entry of publicKeysResponse.data) {
      const publicKey = Utils.fromB64ToArray(entry.key);
      const fingerprint = await this.keyService.getFingerprint(entry.userId, publicKey);
      if (fingerprint != null) {
        this.publicKeys.set(entry.id, publicKey);
        this.fingerprints.set(entry.id, fingerprint.join("-"));
      }
    }

    this.loading = false;
  }

  submit = async () => {
    this.loading = true;
    try {
      const key = await this.getCryptoKey();
      const userIdsWithKeys: { id: string; key: string }[] = [];

      for (const user of this.filteredUsers) {
        const publicKey = this.publicKeys.get(user.id);
        if (publicKey == null) {
          continue;
        }
        const encryptedKey = await this.encryptService.encapsulateKeyUnsigned(key, publicKey);
        userIdsWithKeys.push({
          id: user.id,
          key: encryptedKey.encryptedString,
        });
      }

      const userBulkResponse = await this.postConfirmRequest(userIdsWithKeys);

      userBulkResponse.data.forEach((entry) => {
        const error = entry.error !== "" ? entry.error : this.i18nService.t("bulkConfirmMessage");
        this.statuses.set(entry.id, error);
      });

      this.done = true;
    } catch (e) {
      this.error = e.message;
    }
    this.loading = false;
  };

  protected abstract getCryptoKey(): Promise<SymmetricCryptoKey>;
  protected abstract getPublicKeys(): Promise<
    ListResponse<OrganizationUserBulkPublicKeyResponse | ProviderUserBulkPublicKeyResponse>
  >;
  protected abstract isAccepted(user: BulkUserDetails): boolean;
  protected abstract postConfirmRequest(
    userIdsWithKeys: { id: string; key: string }[],
  ): Promise<ListResponse<OrganizationUserBulkResponse | ProviderUserBulkResponse>>;
}
