// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SelectionModel } from "@angular/cdk/collections";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { AsyncPipe } from "@angular/common";
import { Component, input, output, effect, inject, computed } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Observable, of, switchMap } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
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
} from "@bitwarden/components";
import { OrganizationId } from "@bitwarden/sdk-internal";
import { I18nPipe } from "@bitwarden/ui-common";
import { VaultItem, VaultItemEvent } from "@bitwarden/vault";

import { VaultCipherRowComponent } from "./vault-items/vault-cipher-row.component";
import { VaultCollectionRowComponent } from "./vault-items/vault-collection-row.component";

// Fixed manual row height required due to how cdk-virtual-scroll works
export const RowHeight = 75;
export const RowHeightClass = `tw-h-[75px]`;

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
  ],
})
export class VaultListComponent<C extends CipherViewLike> {
  protected RowHeight = RowHeight;

  protected readonly disabled = input<boolean>();
  protected readonly showOwner = input<boolean>();
  protected readonly useEvents = input<boolean>();
  protected readonly showPremiumFeatures = input<boolean>();
  protected readonly allOrganizations = input<Organization[]>([]);
  protected readonly allCollections = input<CollectionView[]>([]);
  protected readonly userCanArchive = input<boolean>();
  protected readonly enforceOrgDataOwnershipPolicy = input<boolean>();
  protected readonly placeholderText = input<string>("");
  protected readonly ciphers = input<C[]>([]);
  protected readonly collections = input<CollectionView[]>([]);

  protected onEvent = output<VaultItemEvent<C>>();

  protected cipherAuthorizationService = inject(CipherAuthorizationService);
  protected restrictedItemTypesService = inject(RestrictedItemTypesService);
  protected cipherArchiveService = inject(CipherArchiveService);

  protected dataSource = new TableDataSource<VaultItem<C>>();
  protected selection = new SelectionModel<VaultItem<C>>(true, [], true);
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
    const ciphers: VaultItem<C>[] = this.ciphers()
      .filter(
        (cipher) =>
          !this.restrictedItemTypesService.isCipherRestricted(cipher, this.restrictedTypes),
      )
      .map((cipher) => ({ cipher }));
    const items: VaultItem<C>[] = [].concat(collections).concat(ciphers);

    this.dataSource.data = items;
  }

  protected assignToCollections() {
    this.event({
      type: "assignToCollections",
      items: this.selection.selected
        .filter((item) => item.cipher !== undefined)
        .map((item) => item.cipher),
    });
  }

  protected showAssignToCollections(): boolean {
    // When the user doesn't belong to an organization, hide assign to collections
    if (this.allOrganizations().length === 0) {
      return false;
    }

    if (this.selection.selected.length === 0) {
      return false;
    }

    const hasPersonalItems = this.hasPersonalItems();
    const uniqueCipherOrgIds = this.getUniqueOrganizationIds();
    const hasEditableCollections = this.allCollections().some((collection) => {
      return !collection.readOnly;
    });

    // Return false if items are from different organizations
    if (uniqueCipherOrgIds.size > 1) {
      return false;
    }

    // If all selected items are personal, return based on personal items
    if (uniqueCipherOrgIds.size === 0 && hasEditableCollections) {
      return hasPersonalItems;
    }

    const collectionNotSelected =
      this.selection.selected.filter((item) => item.collection).length === 0;

    return this.allCiphersHaveEditAccess() && collectionNotSelected && hasEditableCollections;
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

  private hasPersonalItems(): boolean {
    return this.selection.selected.some(({ cipher }) => !cipher?.organizationId);
  }

  private allCiphersHaveEditAccess(): boolean {
    return this.selection.selected
      .filter(({ cipher }) => cipher)
      .every(({ cipher }) => cipher?.edit && cipher?.viewPassword);
  }

  private getUniqueOrganizationIds(): Set<string | [] | OrganizationId> {
    return new Set(this.selection.selected.flatMap((i) => i.cipher?.organizationId ?? []));
  }
}
