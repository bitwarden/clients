// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject, Injectable } from "@angular/core";
import { combineLatest, filter, firstValueFrom, map, switchMap } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { OrganizationUserStatusType, PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherFormConfig, CipherFormConfigService, CipherFormMode } from "@bitwarden/vault";

import { RoutedVaultFilterService } from "../../individual-vault/vault-filter/services/routed-vault-filter.service";

/** Admin Console implementation of the `CipherFormConfigService`. */
@Injectable()
export class AdminConsoleCipherFormConfigService implements CipherFormConfigService {
  private policyService: PolicyService = inject(PolicyService);
  private organizationService: OrganizationService = inject(OrganizationService);
  private routedVaultFilterService: RoutedVaultFilterService = inject(RoutedVaultFilterService);
  private collectionAdminService: CollectionAdminService = inject(CollectionAdminService);
  private cipherService: CipherService = inject(CipherService);
  private apiService: ApiService = inject(ApiService);
  private accountService: AccountService = inject(AccountService);

  private userId$ = this.accountService.activeAccount$.pipe(getUserId);

  private organizationDataOwnershipDisabled$ = this.userId$.pipe(
    switchMap((userId) =>
      this.policyService.policyAppliesToUser$(PolicyType.OrganizationDataOwnership, userId),
    ),
    map((p) => !p),
  );

  private organizationId$ = this.routedVaultFilterService.filter$.pipe(
    map((filter) => filter.organizationId),
    filter((filter) => filter !== undefined),
  );

  private allOrganizations$ = this.userId$.pipe(
    switchMap((userId) =>
      this.organizationService.organizations$(userId).pipe(
        map((orgs) => {
          return orgs.filter(
            (o) => o.isMember && o.enabled && o.status === OrganizationUserStatusType.Confirmed,
          );
        }),
      ),
    ),
  );

  private organization$ = combineLatest([this.allOrganizations$, this.organizationId$]).pipe(
    map(([orgs, orgId]) => orgs.find((o) => o.id === orgId)),
  );

  private allCollections$ = combineLatest([this.organization$, this.userId$]).pipe(
    switchMap(([org, userId]) => this.collectionAdminService.collectionAdminViews$(org.id, userId)),
  );

  async buildConfig(
    mode: CipherFormMode,
    cipherId?: CipherId,
    cipherType?: CipherType,
  ): Promise<CipherFormConfig> {
    const [organization, organizationDataOwnershipDisabled, allOrganizations, allCollections] =
      await firstValueFrom(
        combineLatest([
          this.organization$,
          this.organizationDataOwnershipDisabled$,
          this.allOrganizations$,
          this.allCollections$,
        ]),
      );

    // When cloning from within the Admin Console, all organizations should be available.
    // Otherwise only the one in context should be
    const organizations = mode === "clone" ? allOrganizations : [organization];
    // Only allow the user to assign to their personal vault when cloning and
    // the policies are enabled for it.
    const disableOrganizationDataOwnershipOnlyForClone =
      mode === "clone" ? organizationDataOwnershipDisabled : false;
    const cipher = await this.getCipher(cipherId, organization);
    return {
      mode,
      cipherType: cipher?.type ?? cipherType ?? CipherType.Login,
      admin: organization.canEditAllCiphers ?? false,
      organizationDataOwnershipDisabled: disableOrganizationDataOwnershipOnlyForClone,
      originalCipher: cipher,
      collections: allCollections,
      organizations,
      folders: [], // folders not applicable in the admin console
      hideIndividualVaultFields: true,
      isAdminConsole: true,
    };
  }

  async getCipher(id: CipherId | null, organization: Organization): Promise<Cipher | null> {
    if (id == null) {
      return null;
    }

    const localCipher = await this.cipherService.get(id, organization.userId as UserId);

    // Fetch from the API because we don't need the permissions in local state OR the cipher was not found (e.g. unassigned)
    if (organization.canEditAllCiphers || localCipher == null) {
      return await this.getCipherFromAdminApi(id);
    }

    return localCipher;
  }

  private async getCipherFromAdminApi(id: CipherId): Promise<Cipher> {
    const cipherResponse = await this.apiService.getCipherAdmin(id);
    // Ensure admin response includes permissions that allow editing
    cipherResponse.edit = true;
    cipherResponse.viewPassword = true;

    const cipherData = new CipherData(cipherResponse);
    return new Cipher(cipherData);
  }
}
