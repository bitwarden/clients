import { CommonModule } from "@angular/common";
import { Component, inject, OnInit, input, output } from "@angular/core";
import { firstValueFrom, Observable, Subject, takeUntil } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { NavigationModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  OrganizationFilter,
  CipherTypeFilter,
  CollectionFilter,
  FolderFilter,
  VaultFilter,
  VaultFilterServiceAbstraction as VaultFilterService,
  RoutedVaultFilterBridgeService,
} from "@bitwarden/vault";

import { FolderFilterComponent } from "./filters/folder-filter.component";
import { OrganizationFilterComponent } from "./filters/organization-filter.component";
import { StatusFilterComponent } from "./filters/status-filter.component";
import { TypeFilterComponent } from "./filters/type-filter.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-vault-filter",
  templateUrl: "vault-filter.component.html",
  standalone: true,
  imports: [
    I18nPipe,
    NavigationModule,
    CommonModule,
    OrganizationFilterComponent,
    StatusFilterComponent,
    TypeFilterComponent,
    FolderFilterComponent,
  ],
})
export class VaultFilterComponent implements OnInit {
  private routedVaultFilterBridgeService = inject(RoutedVaultFilterBridgeService);
  private vaultFilterService: VaultFilterService = inject(VaultFilterService);
  private accountService: AccountService = inject(AccountService);
  private cipherArchiveService: CipherArchiveService = inject(CipherArchiveService);
  private policyService: PolicyService = inject(PolicyService);
  private componentIsDestroyed$ = new Subject<boolean>();

  protected activeFilter: VaultFilter;
  protected readonly hideFolders = input(false);
  protected readonly hideCollections = input(false);
  protected readonly hideFavorites = input(false);
  protected readonly hideTrash = input(false);
  protected readonly hideOrganizations = input(false);
  protected onFilterChange = output<VaultFilter>();

  private activeUserId: UserId;
  protected isLoaded = false;
  protected showArchiveVaultFilter = false;
  protected activeOrganizationDataOwnershipPolicy: boolean;
  protected activeSingleOrganizationPolicy: boolean;
  protected organizations$: Observable<TreeNode<OrganizationFilter>>;
  protected collections$: Observable<TreeNode<CollectionFilter>>;
  protected folders$: Observable<TreeNode<FolderFilter>>;
  protected cipherTypes$: Observable<TreeNode<CipherTypeFilter>>;

  private async setActivePolicies() {
    this.activeOrganizationDataOwnershipPolicy = await firstValueFrom(
      this.policyService.policyAppliesToUser$(
        PolicyType.OrganizationDataOwnership,
        this.activeUserId,
      ),
    );
    this.activeSingleOrganizationPolicy = await firstValueFrom(
      this.policyService.policyAppliesToUser$(PolicyType.SingleOrg, this.activeUserId),
    );
  }

  async ngOnInit(): Promise<void> {
    this.activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    this.organizations$ = this.vaultFilterService.organizationTree$;
    if (
      this.organizations$ != null &&
      (await firstValueFrom(this.organizations$)).children.length > 0
    ) {
      await this.setActivePolicies();
    }
    this.cipherTypes$ = this.vaultFilterService.cipherTypeTree$;
    this.folders$ = this.vaultFilterService.folderTree$;
    this.collections$ = this.vaultFilterService.collectionTree$;

    this.showArchiveVaultFilter = await firstValueFrom(
      this.cipherArchiveService.hasArchiveFlagEnabled$(),
    );

    // Subscribe to the active filter from the bridge service
    this.routedVaultFilterBridgeService.activeFilter$
      .pipe(takeUntil(this.componentIsDestroyed$))
      .subscribe((filter) => {
        this.activeFilter = filter;
      });

    this.isLoaded = true;
  }
}
