import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  model,
  NgZone,
  OnInit,
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
  startWith,
  switchMap,
} from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
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
export class VaultFilterComponent implements OnInit {
  private readonly vaultFilterService = inject(VaultFilterServiceAbstraction);
  private readonly i18nService = inject(I18nService);
  private readonly accountService = inject(AccountService);
  private readonly restrictedItemTypesService = inject(RestrictedItemTypesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  /** Tracks which org id filters were last built for, to avoid redundant rebuilds. */
  private readonly builtOrgId = signal<string | undefined>(undefined);

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
    // toObservable must be set up in the constructor (injection context).
    // ngOnInit handles the synchronous initial build before the first view evaluation;
    // this subscription handles org changes after the initial render and resolves the
    // default collection node selection (which requires an async tree emission).
    toObservable(this.organization)
      .pipe(
        filter((org): org is Organization => !!org),
        switchMap(async (org) => {
          // Skip the rebuild if ngOnInit already built filters for this org.
          if (org.id !== this.builtOrgId()) {
            this.builtOrgId.set(org.id);
            this.vaultFilterService.setOrganizationFilter(org);
            // Re-enter Angular's zone: toObservable's effect runs outside NgZone,
            // so signal writes here would not schedule a CD run on their own.
            this.ngZone.run(() => {
              this.filters.set(this.buildAllFilters());
              this.isLoaded.set(true);
              this.cdr.markForCheck();
            });
          }

          const defaultCollectionNode = !this.activeFilter().selectedCipherTypeNode
            ? ((await firstValueFrom(
                this.filters()!.collectionFilter!.data$,
              )) as TreeNode<CollectionFilter>)
            : null;

          return { defaultCollectionNode };
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ defaultCollectionNode }) => {
        if (defaultCollectionNode) {
          this.ngZone.run(() => {
            this.activeFilter().resetFilter();
            this.activeFilter().selectedCollectionNode = defaultCollectionNode;
            this.cdr.markForCheck();
          });
        }
      });
  }

  ngOnInit(): void {
    const org = this.organization();
    if (!org) {
      return;
    }

    // Build filters synchronously before the first view evaluation. ngOnInit runs
    // before Angular checks this component's template, so setting isLoaded here means
    // the @else branch (with all filter sections) renders on the very first pass —
    // no loading spinner is ever shown.
    this.builtOrgId.set(org.id);
    this.vaultFilterService.setOrganizationFilter(org);
    this.filters.set(this.buildAllFilters());
    this.isLoaded.set(true);
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

  // Each add*Filter method constructs a VaultFilterSection with a lazy data$ observable.
  // None of them do any actual async I/O, so they can all run synchronously.
  buildAllFilters(): VaultFilterList {
    return {
      typeFilter: this.addTypeFilter(["favorites"], this.organization()?.id),
      collectionFilter: this.addCollectionFilter(),
      trashFilter: this.addTrashFilter(),
    };
  }

  protected addCollectionFilter(): VaultFilterSection {
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

  protected addTypeFilter(
    excludeTypes: CipherStatus[] = [],
    organizationId?: string,
  ): VaultFilterSection {
    const allFilter: CipherTypeFilter = {
      id: "AllItems",
      name: "allItems",
      type: "all",
    };

    const data$ = combineLatest([
      this.restrictedItemTypesService.restricted$,
      // startWith([]) lets combineLatest emit immediately (before allCiphers$ resolves
      // its API call), so the type filter renders on the first CD cycle. When actual
      // ciphers arrive, the filter recomputes; for users with no restricted types the
      // value is identical and distinctUntilChanged suppresses a spurious re-render.
      this.ciphers$().pipe(startWith([] as CipherView[])),
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

  protected addTrashFilter(): VaultFilterSection {
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
