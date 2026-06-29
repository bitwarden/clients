import { computed, Directive, inject, OnInit, signal } from "@angular/core";

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
  protected keyService = inject(KeyService);
  protected encryptService = inject(EncryptService);
  protected i18nService = inject(I18nService);

  protected readonly users = signal<BulkUserDetails[]>([]);
  protected readonly excludedUsers = computed(() =>
    this.users().filter((user) => !this.isAccepted(user)),
  );
  protected readonly filteredUsers = computed(() =>
    this.users().filter((user) => this.isAccepted(user)),
  );

  protected readonly publicKeys = signal(new Map<string, Uint8Array>());
  protected readonly fingerprints = signal(new Map<string, string>());

  protected readonly statuses = signal(new Map<string, string>());
  protected readonly done = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | undefined>(undefined);

  async ngOnInit() {
    if (this.filteredUsers().length <= 0) {
      this.done.set(true);
      this.loading.set(false);
      return;
    }
    try {
      const publicKeysResponse = await this.getPublicKeys();

      const newPublicKeys = new Map<string, Uint8Array>();
      const newFingerprints = new Map<string, string>();
      for (const entry of publicKeysResponse.data) {
        const publicKey = Utils.fromB64ToArray(entry.key);
        const fingerprint = await this.keyService.getFingerprint(entry.userId, publicKey);
        if (fingerprint != null) {
          newPublicKeys.set(entry.id, publicKey);
          newFingerprints.set(entry.id, fingerprint.join("-"));
        }
      }
      this.publicKeys.set(newPublicKeys);
      this.fingerprints.set(newFingerprints);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loading.set(false);
    }
  }

  submit = async () => {
    this.loading.set(true);
    try {
      const key = await this.getCryptoKey();
      const userIdsWithKeys: { id: string; key: string }[] = [];

      for (const user of this.filteredUsers()) {
        const publicKey = this.publicKeys().get(user.id);
        if (publicKey == null) {
          continue;
        }

        const encryptedKey = await this.encryptService.encapsulateKeyUnsigned(key, publicKey);

        if (encryptedKey.encryptedString == null) {
          throw new Error("Key not found.");
        }
        userIdsWithKeys.push({
          id: user.id,
          key: encryptedKey.encryptedString,
        });
      }

      const userBulkResponse = await this.postConfirmRequest(userIdsWithKeys);

      const newStatuses = new Map<string, string>();
      userBulkResponse.data.forEach((entry) => {
        const error = entry.error !== "" ? entry.error : this.i18nService.t("bulkConfirmMessage");
        newStatuses.set(entry.id, error);
      });
      this.statuses.set(newStatuses);

      this.done.set(true);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.loading.set(false);
    }
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
