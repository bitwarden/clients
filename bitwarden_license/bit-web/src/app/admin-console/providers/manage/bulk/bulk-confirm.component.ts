import { Component, Input } from "@angular/core";

import { ProviderUserStatusType } from "@bitwarden/common/admin-console/enums";
import { ProviderUserBulkConfirmRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-user-bulk-confirm.request";
import { ProviderUserBulkRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-user-bulk.request";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { BulkConfirmComponent as OrganizationBulkConfirmComponent } from "@bitwarden/web-vault/app/admin-console/organizations/members/components/bulk/bulk-confirm.component";
import { BulkUserDetails } from "@bitwarden/web-vault/app/admin-console/organizations/members/components/bulk/bulk-status.component";

@Component({
  templateUrl:
    "../../../../../../../../apps/web/src/app/admin-console/organizations/members/components/bulk/bulk-confirm.component.html",
})
export class BulkConfirmComponent extends OrganizationBulkConfirmComponent {
  @Input() providerId: string;

  protected override isAccepted(user: BulkUserDetails) {
    return user.status === ProviderUserStatusType.Accepted;
  }

  protected override async getPublicKeys() {
    const request = new ProviderUserBulkRequest(this.filteredUsers.map((user) => user.id));
    return await this.apiService.postProviderUsersPublicKey(this.providerId, request);
  }

  protected override getCryptoKey(): Promise<SymmetricCryptoKey> {
    return this.cryptoService.getProviderKey(this.providerId);
  }

  protected override async postConfirmRequest(userIdsWithKeys: any[]) {
    const request = new ProviderUserBulkConfirmRequest(userIdsWithKeys);
    return await this.apiService.postProviderUserBulkConfirm(this.providerId, request);
  }
}
