// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, inject, OnInit, output, computed, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { firstValueFrom, Subject, takeUntil } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { NavigationModule, DialogService, A11yTitleDirective } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  FolderFilter,
  VaultFilter,
  VaultFilterServiceAbstraction as VaultFilterService,
  AddEditFolderDialogComponent,
  RoutedVaultFilterBridgeService,
} from "@bitwarden/vault";

import { DesktopPremiumUpgradePromptService } from "../../../../services/desktop-premium-upgrade-prompt.service";

import { CollectionFilterComponent } from "./filters/collection-filter.component";
import { FolderFilterComponent } from "./filters/folder-filter.component";
import { OrganizationFilterComponent } from "./filters/organization-filter.component";
import { StatusFilterComponent } from "./filters/status-filter.component";
import { TypeFilterComponent } from "./filters/type-filter.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-vault-filter",
  templateUrl: "vault-filter.component.html",
  imports: [
    I18nPipe,
    NavigationModule,
    CommonModule,
    OrganizationFilterComponent,
    StatusFilterComponent,
    TypeFilterComponent,
    CollectionFilterComponent,
    FolderFilterComponent,
    A11yTitleDirective,
  ],
  providers: [
    {
      provide: PremiumUpgradePromptService,
      useClass: DesktopPremiumUpgradePromptService,
    },
  ],
})
export class VaultFilterComponent implements OnInit {
  private routedVaultFilterBridgeService = inject(RoutedVaultFilterBridgeService);
  private vaultFilterService: VaultFilterService = inject(VaultFilterService);
  private accountService: AccountService = inject(AccountService);
  private cipherArchiveService: CipherArchiveService = inject(CipherArchiveService);
  private folderService: FolderService = inject(FolderService);
  private policyService: PolicyService = inject(PolicyService);
  private dialogService: DialogService = inject(DialogService);
  private componentIsDestroyed$ = new Subject<boolean>();

  protected readonly activeFilter = signal<VaultFilter | null>(null);
  protected onFilterChange = output<VaultFilter>();

  private activeUserId: UserId;
  protected isLoaded = false;
  protected showArchiveVaultFilter = false;
  protected activeOrganizationDataOwnershipPolicy: boolean;
  protected activeSingleOrganizationPolicy: boolean;
  protected readonly organizations = toSignal(this.vaultFilterService.organizationTree$);
  protected readonly collections = toSignal(this.vaultFilterService.collectionTree$);
  protected readonly folders = toSignal(this.vaultFilterService.folderTree$);
  protected readonly cipherTypes = toSignal(this.vaultFilterService.cipherTypeTree$);

  protected readonly showCollectionsFilter = computed<boolean>(() => {
    return (
      this.organizations() != null &&
      this.nonIndividualVaultOrganizations().length > 0 &&
      !this.activeFilter()?.isMyVaultSelected &&
      !this.allOrganizationsDisabled()
    );
  });

  protected readonly allOrganizationsDisabled = computed<boolean>(() => {
    if (!this.organizations()) {
      return false;
    }
    const orgs = this.nonIndividualVaultOrganizations();
    return orgs.length > 0 && orgs.every((org) => !org.node.enabled);
  });

  private nonIndividualVaultOrganizations() {
    return this.organizations().children.filter((org) => org.node.id !== "MyVault");
  }

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
    if (this.organizations() != null && this.organizations().children.length > 0) {
      await this.setActivePolicies();
    }

    this.showArchiveVaultFilter = await firstValueFrom(
      this.cipherArchiveService.hasArchiveFlagEnabled$,
    );

    this.routedVaultFilterBridgeService.activeFilter$
      .pipe(takeUntil(this.componentIsDestroyed$))
      .subscribe((filter) => {
        this.activeFilter.set(filter);
      });

    this.isLoaded = true;
  }

  protected async editFolder(folder: FolderFilter) {
    if (!this.activeUserId) {
      return;
    }
    const folderView = await firstValueFrom(
      this.folderService.getDecrypted$(folder.id, this.activeUserId),
    );

    if (!folderView) {
      return;
    }

    AddEditFolderDialogComponent.open(this.dialogService, {
      editFolderConfig: {
        folder: {
          ...folderView,
        },
      },
    });
  }
}
