// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SelectionModel } from "@angular/cdk/collections";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { AsyncPipe } from "@angular/common";
import { Component, input, output, effect, inject, computed } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { Observable, of, switchMap } from "rxjs";

import { SearchPipe } from "@bitwarden/angular/pipes/search.pipe";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
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
  SearchModule,
} from "@bitwarden/components";
import { OrganizationId } from "@bitwarden/sdk-internal";
import { I18nPipe } from "@bitwarden/ui-common";
import { NewCipherMenuComponent, VaultItem, VaultItemEvent } from "@bitwarden/vault";

import { DesktopHeaderComponent } from "../../../app/layout/header/desktop-header.component";

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
    SearchModule,
    FormsModule,
    DesktopHeaderComponent,
    NewCipherMenuComponent,
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
  // Encompasses functionality only available from the organization vault context
  protected readonly showAdminActions = input<boolean>(false);
  protected readonly allOrganizations = input<Organization[]>([]);
  protected readonly allCollections = input<CollectionView[]>([]);
  protected readonly showPermissionsColumn = input<boolean>(false);
  protected readonly viewingOrgVault = input<boolean>();
  protected readonly addAccessStatus = input<number>();
  protected readonly addAccessToggle = input<boolean>();
  protected readonly activeCollection = input<CollectionView | undefined>();
  protected readonly userCanArchive = input<boolean>();
  protected readonly enforceOrgDataOwnershipPolicy = input<boolean>();
  protected readonly placeholderText = input<string>("");

  protected readonly ciphers = input<C[]>([]);

  protected readonly collections = input<CollectionView[]>([]);

  protected onEvent = output<VaultItemEvent<C>>();
  protected onAddCipher = output<CipherType>();
  protected onAddFolder = output<void>();

  protected cipherAuthorizationService = inject(CipherAuthorizationService);
  protected restrictedItemTypesService = inject(RestrictedItemTypesService);
  protected cipherArchiveService = inject(CipherArchiveService);
  private searchService = inject(SearchService);
  private searchPipe = inject(SearchPipe);

  protected dataSource = new TableDataSource<VaultItem<C>>();
  protected selection = new SelectionModel<VaultItem<C>>(true, [], true);
  private restrictedTypes: RestrictedCipherType[] = [];
  protected searchText = "";

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

  protected onSearchTextChanged(searchText: string) {
    this.searchText = searchText;
    this.refreshItems();
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
        return this.cipherAuthorizationService.canCloneCipher$(
          vaultItem.cipher,
          this.showAdminActions(),
        );
      }),
    );
  }

  protected canEditCipher(cipher: C) {
    if (cipher.organizationId == null) {
      return true;
    }

    const organization = this.allOrganizations().find((o) => o.id === cipher.organizationId);
    return (organization.canEditAllCiphers && this.viewingOrgVault()) || cipher.edit;
  }

  protected canAssignCollections(cipher: C) {
    const organization = this.allOrganizations().find((o) => o.id === cipher.organizationId);
    const editableCollections = this.allCollections().filter((c) => !c.readOnly);

    return (
      (organization?.canEditAllCiphers && this.viewingOrgVault()) ||
      (CipherViewLikeUtils.canAssignToCollections(cipher) && editableCollections.length > 0)
    );
  }

  protected canManageCollection(cipher: C) {
    // If the cipher is not part of an organization (personal item), user can manage it
    if (cipher.organizationId == null) {
      return true;
    }

    // Check for admin access in AC vault
    if (this.showAdminActions()) {
      const organization = this.allOrganizations().find((o) => o.id === cipher.organizationId);
      // If the user is an admin, they can delete an unassigned cipher
      if (cipher.collectionIds.length === 0) {
        return organization?.canEditUnmanagedCollections === true;
      }

      if (
        organization?.permissions.editAnyCollection ||
        (organization?.allowAdminAccessToAllCollectionItems && organization.isAdmin)
      ) {
        return true;
      }
    }

    if (this.activeCollection()) {
      return this.activeCollection().manage === true;
    }

    return this.allCollections()
      .filter((c) => cipher.collectionIds.includes(c.id as any))
      .some((collection) => collection.manage);
  }

  private refreshItems() {
    const filteredCollections: CollectionView[] = this.searchText
      ? this.searchPipe.transform(
          this.collections() || [],
          this.searchText,
          (collection) => collection.name,
          (collection) => collection.id,
        )
      : this.collections() || [];

    const allowedCiphers = this.ciphers().filter(
      (cipher) => !this.restrictedItemTypesService.isCipherRestricted(cipher, this.restrictedTypes),
    );

    const filteredCiphers: C[] = this.searchText
      ? this.searchService.searchCiphersBasic(allowedCiphers, this.searchText)
      : allowedCiphers;

    const collections: VaultItem<C>[] = filteredCollections.map((collection) => ({ collection }));
    const ciphers: VaultItem<C>[] = filteredCiphers.map((cipher) => ({ cipher }));
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

    const [orgId] = uniqueCipherOrgIds;
    const organization = this.allOrganizations().find((o) => o.id === orgId);

    const canEditOrManageAllCiphers = organization?.canEditAllCiphers && this.viewingOrgVault();

    const collectionNotSelected =
      this.selection.selected.filter((item) => item.collection).length === 0;

    return (
      (canEditOrManageAllCiphers || this.allCiphersHaveEditAccess()) &&
      collectionNotSelected &&
      hasEditableCollections
    );
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
