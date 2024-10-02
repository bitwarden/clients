import { DIALOG_DATA, DialogConfig } from "@angular/cdk/dialog";
import { Component, Inject, OnInit } from "@angular/core";

import {
  OrganizationUserApiService,
  OrganizationUserBulkConfirmRequest,
} from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { DialogService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { BulkUserDetails } from "./bulk-status.component";

type BulkConfirmDialogData = {
  organizationId: string;
  users: BulkUserDetails[];
};

@Component({
  selector: "app-bulk-confirm",
  templateUrl: "bulk-confirm.component.html",
})
export class BulkConfirmComponent implements OnInit {
  organizationId: string;
  users: BulkUserDetails[];

  excludedUsers: BulkUserDetails[];
  filteredUsers: BulkUserDetails[];
  publicKeys: Map<string, Uint8Array> = new Map();
  fingerprints: Map<string, string> = new Map();
  statuses: Map<string, string> = new Map();

  loading = true;
  done = false;
  error: string;

  constructor(
    @Inject(DIALOG_DATA) protected data: BulkConfirmDialogData,
    protected keyService: KeyService,
    protected encryptService: EncryptService,
    protected apiService: ApiService,
    private organizationUserApiService: OrganizationUserApiService,
    private i18nService: I18nService,
  ) {
    this.organizationId = data.organizationId;
    this.users = data.users;
  }

  async ngOnInit() {
    this.excludedUsers = this.users.filter((u) => !this.isAccepted(u));
    this.filteredUsers = this.users.filter((u) => this.isAccepted(u));

    if (this.filteredUsers.length <= 0) {
      this.done = true;
    }

    const response = await this.getPublicKeys();

    for (const entry of response.data) {
      const publicKey = Utils.fromB64ToArray(entry.key);
      const fingerprint = await this.keyService.getFingerprint(entry.userId, publicKey);
      if (fingerprint != null) {
        this.publicKeys.set(entry.id, publicKey);
        this.fingerprints.set(entry.id, fingerprint.join("-"));
      }
    }

    this.loading = false;
  }

  async submit() {
    this.loading = true;
    try {
      const key = await this.getCryptoKey();
      const userIdsWithKeys: any[] = [];
      for (const user of this.filteredUsers) {
        const publicKey = this.publicKeys.get(user.id);
        if (publicKey == null) {
          continue;
        }
        const encryptedKey = await this.encryptService.rsaEncrypt(key.key, publicKey);
        userIdsWithKeys.push({
          id: user.id,
          key: encryptedKey.encryptedString,
        });
      }
      const response = await this.postConfirmRequest(userIdsWithKeys);

      response.data.forEach((entry) => {
        const error = entry.error !== "" ? entry.error : this.i18nService.t("bulkConfirmMessage");
        this.statuses.set(entry.id, error);
      });

      this.done = true;
    } catch (e) {
      this.error = e.message;
    }
    this.loading = false;
  }

  protected isAccepted(user: BulkUserDetails) {
    return user.status === OrganizationUserStatusType.Accepted;
  }

  protected async getPublicKeys() {
    return await this.organizationUserApiService.postOrganizationUsersPublicKey(
      this.organizationId,
      this.filteredUsers.map((user) => user.id),
    );
  }

  protected getCryptoKey(): Promise<SymmetricCryptoKey> {
    return this.keyService.getOrgKey(this.organizationId);
  }

  protected async postConfirmRequest(userIdsWithKeys: any[]) {
    const request = new OrganizationUserBulkConfirmRequest(userIdsWithKeys);
    return await this.organizationUserApiService.postOrganizationUserBulkConfirm(
      this.organizationId,
      request,
    );
  }

  static open(dialogService: DialogService, config: DialogConfig<BulkConfirmDialogData>) {
    return dialogService.open(BulkConfirmComponent, config);
  }
}
