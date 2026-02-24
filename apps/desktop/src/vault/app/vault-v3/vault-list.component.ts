// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ScrollingModule } from "@angular/cdk/scrolling";
import { AsyncPipe } from "@angular/common";
import { Component, input, output, effect, inject, computed } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Observable, of, switchMap } from "rxjs";

import { BitSvg } from "@bitwarden/assets/svg";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  SortDirection,
  TableDataSource,
  TableModule,
  MenuModule,
  ButtonModule,
  IconButtonModule,
  NoItemsModule,
  CalloutComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { NewCipherMenuComponent, VaultItem } from "@bitwarden/vault";

import { VaultCipherRowComponent } from "./vault-items/vault-cipher-row.component";
import { VaultCollectionRowComponent } from "./vault-items/vault-collection-row.component";
import { VaultItemEvent } from "./vault-items/vault-item-event";

// Fixed manual row height required due to how cdk-virtual-scroll works
export const RowHeight = 75;
export const RowHeightClass = `tw-h-[75px]`;
type EmptyStateItem = {
  title: string;
  description: string;
  icon: BitSvg;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-vault-list",
  templateUrl: "vault-list.component.html",
  imports: [
    ScrollingModule,
    TableModule,
    I18nPipe,
    AsyncPipe,
    MenuModule,
    ButtonModule,
    IconButtonModule,
    VaultCollectionRowComponent,
    VaultCipherRowComponent,
    NoItemsModule,
    NewCipherMenuComponent,
    CalloutComponent,
  ],
})
export class VaultListComponent<C extends CipherViewLike> {
  protected RowHeight = RowHeight;

  protected readonly disabled = input<boolean>();
  protected readonly showOwner = input<boolean>();
  protected readonly showPremiumFeatures = input<boolean>();
  protected readonly allOrganizations = input<Organization[]>([]);
  protected readonly allCollections = input<CollectionView[]>([]);
  protected readonly userCanArchive = input<boolean>();
  protected readonly enforceOrgDataOwnershipPolicy = input<boolean>();
  protected readonly placeholderText = input<string>("");
  protected readonly ciphers = input<C[]>([]);
  protected readonly collections = input<CollectionView[]>([]);
  protected readonly isEmpty = input<boolean>();
  protected readonly showAddCipherBtn = input<boolean>();
  protected readonly emptyStateItem = input<EmptyStateItem>();
  readonly showPremiumCallout = input<boolean>(false);

  protected onEvent = output<VaultItemEvent<C>>();
  protected onAddCipher = output<CipherType>();
  protected onAddFolder = output<void>();

  protected cipherAuthorizationService = inject(CipherAuthorizationService);
  protected restrictedItemTypesService = inject(RestrictedItemTypesService);
  protected cipherArchiveService = inject(CipherArchiveService);
  private premiumUpgradePromptService = inject(PremiumUpgradePromptService);

  protected dataSource = new TableDataSource<VaultItem<C>>();
  private restrictedTypes: RestrictedCipherType[] = [];

  protected archiveFeatureEnabled$ = this.cipherArchiveService.hasArchiveFlagEnabled$;

  constructor() {
    this.restrictedItemTypesService.restricted$.pipe(takeUntilDestroyed()).subscribe((types) => {
      this.restrictedTypes = types;
      this.refreshItems();
    });

    // Refresh items when collections or ciphers change
    effect(() => {
      this.collections();
      this.ciphers();
      this.refreshItems();
    });
  }

  protected readonly showExtraColumn = computed(() => this.showOwner());

  protected event(event: VaultItemEvent<C>) {
    this.onEvent.emit(event);
  }

  protected addCipher(type: CipherType) {
    this.onAddCipher.emit(type);
  }

  protected addFolder() {
    this.onAddFolder.emit();
  }

  protected canClone$(vaultItem: VaultItem<C>): Observable<boolean> {
    return this.restrictedItemTypesService.restricted$.pipe(
      switchMap((restrictedTypes) => {
        // This will check for restrictions from org policies before allowing cloning.
        const isItemRestricted = restrictedTypes.some(
          (rt) => rt.cipherType === CipherViewLikeUtils.getType(vaultItem.cipher),
        );
        if (isItemRestricted) {
          return of(false);
        }
        return this.cipherAuthorizationService.canCloneCipher$(vaultItem.cipher);
      }),
    );
  }

  protected canEditCipher(cipher: C) {
    if (cipher.organizationId == null) {
      return true;
    }
    return cipher.edit;
  }

  protected canAssignCollections(cipher: C) {
    const editableCollections = this.allCollections().filter((c) => !c.readOnly);
    return CipherViewLikeUtils.canAssignToCollections(cipher) && editableCollections.length > 0;
  }

  protected canManageCollection(cipher: C) {
    // If the cipher is not part of an organization (personal item), user can manage it
    if (cipher.organizationId == null) {
      return true;
    }

    return this.allCollections()
      .filter((c) => cipher.collectionIds.includes(c.id as any))
      .some((collection) => collection.manage);
  }

  private refreshItems() {
    const collections: VaultItem<C>[] =
      this.collections()?.map((collection) => ({ collection })) || [];
    const ciphers: VaultItem<C>[] = this.ciphers().map((cipher) => ({ cipher }));
    const items: VaultItem<C>[] = [].concat(collections).concat(ciphers);

    this.dataSource.data = items;
  }

  /**
   * Sorts VaultItems, grouping collections before ciphers, and sorting each group alphabetically by name.
   */
  protected sortByName = (a: VaultItem<C>, b: VaultItem<C>, direction: SortDirection) => {
    return this.compareNames(a, b);
  };

  protected sortByOwner = (a: VaultItem<C>, b: VaultItem<C>, direction: SortDirection) => {
    const getOwnerName = (item: VaultItem<C>): string => {
      if (item.cipher) {
        return (item.cipher.organizationId as string) || "";
      } else if (item.collection) {
        return (item.collection.organizationId as string) || "";
      }
      return "";
    };

    const ownerA = getOwnerName(a);
    const ownerB = getOwnerName(b);

    return ownerA.localeCompare(ownerB);
  };

  private compareNames(a: VaultItem<C>, b: VaultItem<C>): number {
    const getName = (item: VaultItem<C>) => item.collection?.name || item.cipher?.name;
    return getName(a)?.localeCompare(getName(b)) ?? -1;
  }

  protected trackByFn(index: number, item: VaultItem<C>) {
    return item.cipher?.id || item.collection?.id || index;
  }

  async navigateToGetPremium() {
    await this.premiumUpgradePromptService.promptForPremium();
  }
}
