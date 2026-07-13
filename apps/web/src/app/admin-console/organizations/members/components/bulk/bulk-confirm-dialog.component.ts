import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { firstValueFrom, map, Observable, switchMap } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserBulkPublicKeyResponse,
  OrganizationUserBulkResponse,
  OrganizationUserService,
} from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProviderUserBulkPublicKeyResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user-bulk-public-key.response";
import { ProviderUserBulkResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user-bulk.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { OrgKey } from "@bitwarden/common/types/key";
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

import { BaseBulkConfirmComponent } from "./base-bulk-confirm.component";
import { BulkUserDetails } from "./bulk-status.component";

type BulkConfirmDialogParams = {
  organization: Organization;
  users: BulkUserDetails[];
};

@Component({
  templateUrl: "bulk-confirm-dialog.component.html",
  selector: "member-bulk-comfirm-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
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
  private readonly organizationUserApiService = inject(OrganizationUserApiService);
  private readonly accountService = inject(AccountService);
  private readonly organizationUserService = inject(OrganizationUserService);

  protected readonly organization: Organization = this.dialogParams.organization;
  protected readonly organizationKey$: Observable<OrgKey>;

  constructor() {
    super();
    this.users.set(this.dialogParams.users);

    this.organizationKey$ = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.keyService.orgKeys$(userId)),
      map((orgKeys) => {
        const orgId = this.dialogParams.organization.id;
        const orgKey = orgKeys?.[orgId] ?? undefined;
        if (orgKey == null) {
          throw new Error(`Organization key not found for org ${orgId}`);
        }

        return orgKey;
      }),
    );
  }

  protected readonly getCryptoKey = async (): Promise<SymmetricCryptoKey> =>
    await firstValueFrom(this.organizationKey$);

  protected readonly getPublicKeys = async (): Promise<
    ListResponse<OrganizationUserBulkPublicKeyResponse | ProviderUserBulkPublicKeyResponse>
  > =>
    await this.organizationUserApiService.postOrganizationUsersPublicKey(
      this.organization.id,
      this.filteredUsers().map((user) => user.id),
    );

  protected readonly isAccepted = (user: BulkUserDetails) =>
    user.status === OrganizationUserStatusType.Accepted;

  protected readonly postConfirmRequest = async (
    userIdsWithKeys: { id: string; key: string }[],
  ): Promise<ListResponse<OrganizationUserBulkResponse | ProviderUserBulkResponse>> => {
    return await firstValueFrom(
      this.organizationUserService.bulkConfirmUsers(this.organization, userIdsWithKeys),
    );
  };

  static open(dialogService: DialogService, config: DialogConfig<BulkConfirmDialogParams>) {
    return dialogService.open(BulkConfirmDialogComponent, config);
  }
}
