import { combineLatest, filter, map, Observable, switchMap } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/common/admin-console/abstractions/organization-user/organization-user-api.service";
import { OrganizationUserService } from "@bitwarden/common/admin-console/abstractions/organization-user/organization-user.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationUserBulkConfirmRequest } from "@bitwarden/common/admin-console/models/request/organization-user/organization-user-bulk-confirm.request";
import { OrganizationUserConfirmRequest } from "@bitwarden/common/admin-console/models/request/organization-user/organization-user-confirm.request";
import { OrganizationUserBulkResponse } from "@bitwarden/common/admin-console/models/response/organization-user/organization-user-bulk.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

export class DefaultOrganizationUserService implements OrganizationUserService {
  constructor(
    protected keyService: KeyService,
    private encryptService: EncryptService,
    private organizationUserApiService: OrganizationUserApiService,
    private accountService: AccountService,
    private i18nService: I18nService,
  ) {}

  private orgKey$(organization: Organization) {
    return this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.keyService.orgKeys$(userId)),
      filter((orgKeys) => !!orgKeys),
      map((organizationKeysById) => organizationKeysById[organization.id as OrganizationId]),
    );
  }

  buildConfirmRequest(
    organization: Organization,
    publicKey: Uint8Array,
  ): Observable<OrganizationUserConfirmRequest> {
    const encryptedCollectionName$ = this.getEncryptedDefaultCollectionName$(organization);

    const encryptedKey$ = this.orgKey$(organization).pipe(
      switchMap((orgKey) => this.encryptService.encapsulateKeyUnsigned(orgKey, publicKey)),
    );

    return combineLatest([encryptedKey$, encryptedCollectionName$]).pipe(
      map(([key, collectionName]) => ({
        key: key.encryptedString,
        defaultUserCollectionName: collectionName.encryptedString,
      })),
    );
  }

  confirmUser(organization: Organization, userId: string, publicKey: Uint8Array): Observable<void> {
    return this.buildConfirmRequest(organization, publicKey).pipe(
      switchMap((request) =>
        this.organizationUserApiService.postOrganizationUserConfirm(
          organization.id,
          userId,
          request,
        ),
      ),
    );
  }

  bulkConfirmUsers(
    organization: Organization,
    userIdsWithKeys: { id: string; key: string }[],
  ): Observable<ListResponse<OrganizationUserBulkResponse>> {
    return this.getEncryptedDefaultCollectionName$(organization).pipe(
      switchMap((collectionName) => {
        const request = new OrganizationUserBulkConfirmRequest(
          userIdsWithKeys,
          collectionName.encryptedString,
        );

        return this.organizationUserApiService.postOrganizationUserBulkConfirm(
          organization.id,
          request,
        );
      }),
    );
  }

  private getEncryptedDefaultCollectionName$(organization: Organization) {
    return this.orgKey$(organization).pipe(
      switchMap((orgKey) =>
        this.encryptService.encryptString(this.i18nService.t("myItems"), orgKey),
      ),
    );
  }
}
