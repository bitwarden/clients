import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { firstValueFrom, map, Observable, switchMap } from "rxjs";

import {
  OrganizationUserBulkPublicKeyResponse,
  OrganizationUserBulkResponse,
} from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProviderUserStatusType } from "@bitwarden/common/admin-console/enums";
import { ProviderUserBulkConfirmRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-user-bulk-confirm.request";
import { ProviderUserBulkRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-user-bulk.request";
import { ProviderUserBulkPublicKeyResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user-bulk-public-key.response";
import { ProviderUserBulkResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user-bulk.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { ProviderId } from "@bitwarden/common/types/guid";
import { ProviderKey } from "@bitwarden/common/types/key";
import {
  AsyncActionsModule,
  AvatarModule,
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogService,
  LinkModule,
  TableModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { BaseBulkConfirmComponent } from "@bitwarden/web-vault/app/admin-console/organizations/members/components/bulk/base-bulk-confirm.component";
import { BulkUserDetails } from "@bitwarden/web-vault/app/admin-console/organizations/members/components/bulk/bulk-status.component";
import { AvatarIdPipe } from "@bitwarden/web-vault/app/admin-console/organizations/members/pipes/avatar-id.pipe";

type BulkConfirmDialogParams = {
  providerId: string;
  users: BulkUserDetails[];
};

@Component({
  templateUrl:
    "../../../../../../../../apps/web/src/app/admin-console/organizations/members/components/bulk/bulk-confirm-dialog.component.html",
  selector: "provider-bulk-comfirm-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    AvatarIdPipe,
    AvatarModule,
    ButtonModule,
    CalloutModule,
    DialogModule,
    I18nPipe,
    LinkModule,
    TableModule,
    UserNamePipe,
  ],
})
export class BulkConfirmDialogComponent extends BaseBulkConfirmComponent {
  private readonly dialogParams = inject<BulkConfirmDialogParams>(DIALOG_DATA);
  private readonly apiService = inject(ApiService);
  private readonly accountService = inject(AccountService);

  protected readonly providerId = this.dialogParams.providerId;
  protected readonly providerKey$: Observable<ProviderKey>;

  constructor() {
    super();

    this.users.set(this.dialogParams.users);
    this.providerKey$ = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.keyService.providerKeys$(userId)),
      map((providerKeysById) => {
        const providerKey = providerKeysById?.[this.providerId as ProviderId];
        if (providerKey == null) {
          throw new Error(`Provider key not found for provider ${this.providerId}`);
        }
        return providerKey;
      }),
    );
  }

  protected readonly getCryptoKey = async (): Promise<SymmetricCryptoKey> =>
    await firstValueFrom(this.providerKey$);

  protected readonly getPublicKeys = async (): Promise<
    ListResponse<OrganizationUserBulkPublicKeyResponse | ProviderUserBulkPublicKeyResponse>
  > => {
    const request = new ProviderUserBulkRequest(this.filteredUsers().map((user) => user.id));
    return await this.apiService.postProviderUsersPublicKey(this.providerId, request);
  };

  protected readonly isAccepted = (user: BulkUserDetails): boolean =>
    user.status === ProviderUserStatusType.Accepted;

  protected readonly postConfirmRequest = async (
    userIdsWithKeys: { id: string; key: string }[],
  ): Promise<ListResponse<OrganizationUserBulkResponse | ProviderUserBulkResponse>> => {
    const request = new ProviderUserBulkConfirmRequest(userIdsWithKeys);
    return await this.apiService.postProviderUserBulkConfirm(this.providerId, request);
  };

  static open(dialogService: DialogService, dialogConfig: DialogConfig<BulkConfirmDialogParams>) {
    return dialogService.open(BulkConfirmDialogComponent, dialogConfig);
  }
}
