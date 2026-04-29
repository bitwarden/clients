import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  model,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toObservable } from "@angular/core/rxjs-interop";
import {
  combineLatest,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CipherViewLikeUtils } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  VaultFilterServiceAbstraction,
  VaultFilterList,
  VaultFilterSection,
  VaultFilterType,
  CollectionFilter,
  CipherStatus,
  CipherTypeFilter,
  VaultFilter,
} from "@bitwarden/vault";

@Component({
  selector: "app-organization-vault-filter",
  templateUrl: "./vault-filter.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class VaultFilterComponent {
  private readonly vaultFilterService = inject(VaultFilterServiceAbstraction);
  private readonly i18nService = inject(I18nService);
  private readonly accountService = inject(AccountService);
  private readonly restrictedItemTypesService = inject(RestrictedItemTypesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly configService = inject(ConfigService);

  readonly activeFilter = input<VaultFilter>(new VaultFilter());
  readonly searchText = model("");

  readonly organization = input<Organization>();

  /** Org-scoped ciphers provided by the parent vault component. Used to build type filter badges
   * without triggering a personal vault decrypt. */
  readonly ciphers$ = input<Observable<CipherView[]>>(of([]));

  readonly filters = signal<VaultFilterList | undefined>(undefined);
  readonly isLoaded = signal(false);
  readonly filtersList = computed(() => {
    const f = this.filters();
    return f ? Object.values(f) : [];
  });

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);

  readonly allTypeFilters: CipherTypeFilter[] = [
    {
      id: "login",
      name: this.i18nService.t("typeLogin"),
      type: CipherType.Login,
      icon: "bwi-globe",
    },
    {
      id: "card",
      name: this.i18nService.t("typeCard"),
      type: CipherType.Card,
      icon: "bwi-credit-card",
    },
    {
      id: "identity",
      name: this.i18nService.t("typeIdentity"),
      type: CipherType.Identity,
      icon: "bwi-id-card",
    },
    {
      id: "note",
      name: this.i18nService.t("note"),
      type: CipherType.SecureNote,
      icon: "bwi-sticky-note",
    },
    {
      id: "sshKey",
      name: this.i18nService.t("typeSshKey"),
      type: CipherType.SshKey,
      icon: "bwi-key",
    },
  ];

  get searchPlaceholder() {
    const filter = this.activeFilter();
    if (filter.isDeleted) {
      return "searchTrash";
    }
    if (filter.cipherType === CipherType.Login) {
      return "searchLogin";
    }
    if (filter.cipherType === CipherType.Card) {
      return "searchCard";
    }
    if (filter.cipherType === CipherType.Identity) {
      return "searchIdentity";
    }
    if (filter.cipherType === CipherType.SecureNote) {
      return "searchSecureNote";
    }
    if (filter.cipherType === CipherType.SshKey) {
      return "searchSshKey";
    }
    if (filter.selectedCollectionNode?.node) {
      return "searchCollection";
    }
    return "searchVault";
  }

  constructor() {
    toObservable(this.organization)
      .pipe(
        filter((org): org is Organization => !!org),
        switchMap(async (org) => {
          this.vaultFilterService.setOrganizationFilter(org);
          const filters = await this.buildAllFilters();

          const defaultCollectionNode = !this.activeFilter().selectedCipherTypeNode
            ? ((await firstValueFrom(
                filters.collectionFilter!.data$,
              )) as TreeNode<CollectionFilter>)
            : null;

          return { filters, defaultCollectionNode };
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ filters, defaultCollectionNode }) => {
        this.filters.set(filters);
        if (defaultCollectionNode) {
          this.activeFilter().resetFilter();
          this.activeFilter().selectedCollectionNode = defaultCollectionNode;
        }
        this.isLoaded.set(true);
      });
  }

  readonly applyTypeFilter = async (filterNode: TreeNode<CipherTypeFilter>): Promise<void> => {
    const filter = this.activeFilter();
    filter.resetFilter();
    filter.selectedCipherTypeNode = filterNode;
  };

  readonly applyCollectionFilter = async (
    collectionNode: TreeNode<CollectionFilter>,
  ): Promise<void> => {
    const filter = this.activeFilter();
    filter.resetFilter();
    filter.selectedCollectionNode = collectionNode;
  };

  protected async addCollectionFilter(): Promise<VaultFilterSection> {
    // Ensure the Collections filter is never collapsed in the org vault.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.removeCollapsibleCollection();

    return {
      data$: this.vaultFilterService.buildTypeTree(
        {
          id: "AllCollections",
          name: "collections",
          type: "all",
          icon: "bwi-collection-shared",
        },
        [
          {
            id: "AllCollections",
            name: "Collections",
            type: "all",
            icon: "bwi-collection-shared",
          },
        ],
      ),
      header: {
        showHeader: false,
        isSelectable: true,
      },
      action: this.applyCollectionFilter as (
        filterNode: TreeNode<VaultFilterType>,
      ) => Promise<void>,
    };
  }

  protected async addTypeFilter(
    excludeTypes: CipherStatus[] = [],
    organizationId?: string,
  ): Promise<VaultFilterSection> {
    const allFilter: CipherTypeFilter = {
      id: "AllItems",
      name: "allItems",
      type: "all",
    };

    const data$ = combineLatest([
      this.restrictedItemTypesService.restricted$,
      this.ciphers$(),
    ]).pipe(
      map(([restrictedTypes, ciphers]) => {
        const restrictedForUser = restrictedTypes
          .filter((r) => {
            if (r.allowViewOrgIds.length === 0) {
              return true;
            }
            return !ciphers?.some((c) => {
              if (c.deletedDate || CipherViewLikeUtils.getType(c) !== r.cipherType) {
                return false;
              }
              if (!c.organizationId) {
                return false;
              }
              if (organizationId && c.organizationId !== organizationId) {
                return false;
              }
              return r.allowViewOrgIds.includes(uuidAsString(c.organizationId));
            });
          })
          .map((r) => r.cipherType);

        const toExclude = [...excludeTypes, ...restrictedForUser];
        return this.allTypeFilters.filter((f) => !toExclude.includes(f.type));
      }),
      switchMap((allowed) => this.vaultFilterService.buildTypeTree(allFilter, allowed)),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    return {
      data$,
      header: {
        showHeader: true,
        isSelectable: true,
      },
      action: this.applyTypeFilter as (filterNode: TreeNode<VaultFilterType>) => Promise<void>,
    };
  }

  async buildAllFilters(): Promise<VaultFilterList> {
    const newTypesEnabled = await firstValueFrom(
      this.configService.getFeatureFlag$(FeatureFlag.PM32009NewItemTypes),
    );

    const excludeTypes: CipherStatus[] = ["favorites"];
    if (!newTypesEnabled) {
      excludeTypes.push(CipherType.BankAccount);
    }

    const builderFilter = {} as VaultFilterList;
    builderFilter.typeFilter = await this.addTypeFilter(excludeTypes, this.organization()?.id);
    builderFilter.collectionFilter = await this.addCollectionFilter();
    builderFilter.trashFilter = await this.addTrashFilter();
    return builderFilter;
  }

  protected async addTrashFilter(): Promise<VaultFilterSection> {
    return {
      data$: this.vaultFilterService.buildTypeTree(
        {
          id: "headTrash",
          name: "HeadTrash",
          type: "trash",
          icon: "bwi-trash",
        },
        [
          {
            id: "trash",
            name: this.i18nService.t("trash"),
            type: "trash",
            icon: "bwi-trash",
          },
        ],
      ),
      header: {
        showHeader: false,
        isSelectable: true,
      },
      action: this.applyTypeFilter as (filterNode: TreeNode<VaultFilterType>) => Promise<void>,
    };
  }

  private async removeCollapsibleCollection(): Promise<void> {
    const collapsedNodes = await firstValueFrom(this.vaultFilterService.collapsedFilterNodes$);
    collapsedNodes.delete("AllCollections");
    const userId = await firstValueFrom(this.activeUserId$);
    await this.vaultFilterService.setCollapsedFilterNodes(collapsedNodes, userId);
  }
}
