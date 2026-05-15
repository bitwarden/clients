import { DestroyRef, inject, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { combineLatest, firstValueFrom, lastValueFrom, Observable, Subject } from "rxjs";
import { distinctUntilChanged, filter, map, shareReplay, switchMap } from "rxjs/operators";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  CollectionAdminView,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageListener } from "@bitwarden/common/platform/messaging";
import { getById } from "@bitwarden/common/platform/misc";
import { CollectionId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { RoutedVaultFilterService } from "@bitwarden/vault";

import { CollectionPermission } from "../../shared/components/access-selector";
import {
  CollectionDialogAction,
  CollectionDialogTabType,
  openCollectionDialog,
} from "../../shared/components/collection-dialog";
import {
  BulkCollectionsDialogComponent,
  BulkCollectionsDialogResult,
} from "../bulk-collections-dialog";
import { ACRoutedVaultFilterModel, toACFilter } from "../models/ac-routed-vault-filter.model";

import { VaultCollectionService } from "./vault-collection.service";

@Injectable()
export class VaultCollectionActionsService {
  private readonly apiService = inject(ApiService);
  private readonly collectionService = inject(CollectionService);
  private readonly cipherService = inject(CipherService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  private readonly i18nService = inject(I18nService);
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly routedVaultFilterService = inject(RoutedVaultFilterService);
  private readonly vaultCollectionService = inject(VaultCollectionService);

  private readonly userId$: Observable<UserId> = this.accountService.activeAccount$.pipe(getUserId);

  private readonly filter$: Observable<ACRoutedVaultFilterModel> =
    this.routedVaultFilterService.filter$.pipe(map(toACFilter), filter(Boolean));

  private readonly organizationId$ = this.filter$.pipe(
    map((f) => f.organizationId),
    distinctUntilChanged(),
  );

  private readonly organization$: Observable<Organization> = combineLatest([
    this.organizationId$,
    this.userId$,
  ]).pipe(
    switchMap(([orgId, userId]) =>
      this.organizationService.organizations$(userId).pipe(getById(orgId)),
    ),
    filter((org) => org != null),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  private readonly selectedCollection$ = this.vaultCollectionService.selectedCollection$;

  private readonly messageListener = inject(MessageListener);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _refresh$ = new Subject<void>();
  readonly refresh$ = this._refresh$.asObservable();

  constructor() {
    this.messageListener.allMessages$
      .pipe(
        filter((msg) => msg.command === "syncCompleted" && !!msg.successfully),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this._refresh$.next());
  }

  private refresh(): void {
    this._refresh$.next();
  }

  async addCollection(): Promise<void> {
    const organization = await firstValueFrom(this.organization$);
    const selectedCollection = await firstValueFrom(this.selectedCollection$);
    const dialog = openCollectionDialog(this.dialogService, {
      data: {
        organizationId: organization.id,
        parentCollectionId: selectedCollection?.node.id,
        limitNestedCollections: !organization.canEditAnyCollection,
        isAdminConsoleActive: true,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    if (
      result?.action === CollectionDialogAction.Saved ||
      result?.action === CollectionDialogAction.Deleted
    ) {
      this.refresh();
    }
  }

  async editCollection(
    c: CollectionAdminView,
    tab: CollectionDialogTabType,
    readonly: boolean,
    initialPermission?: CollectionPermission,
  ): Promise<void> {
    const organization = await firstValueFrom(this.organization$);
    const dialog = openCollectionDialog(this.dialogService, {
      data: {
        collectionId: c.id,
        organizationId: organization.id,
        initialTab: tab,
        readonly: readonly,
        isAddAccessCollection: c.unmanaged,
        limitNestedCollections: !organization.canEditAnyCollection,
        isAdminConsoleActive: true,
        initialPermission,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    if (
      result?.action === CollectionDialogAction.Saved ||
      result?.action === CollectionDialogAction.Deleted
    ) {
      this.refresh();

      const selectedCollection = await firstValueFrom(this.selectedCollection$);
      // If we deleted the selected collection, navigate up/away
      if (
        result.action === CollectionDialogAction.Deleted &&
        selectedCollection?.node.id === c.id
      ) {
        void this.router.navigate([], {
          queryParams: { collectionId: selectedCollection.parent?.node.id ?? null },
          queryParamsHandling: "merge",
          replaceUrl: true,
        });
      }
    }
  }

  async deleteCollection(collection: CollectionAdminView): Promise<void> {
    const organization = await firstValueFrom(this.organization$);
    const userId = await firstValueFrom(this.userId$);
    if (!collection.canDelete(organization)) {
      this.showMissingPermissionsError();
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: collection.name,
      content: { key: "deleteCollectionConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }
    try {
      await this.apiService.deleteCollection(organization.id, collection.id);
      await this.collectionService.delete([collection.id] as CollectionId[], userId);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("deletedCollectionId", collection.name),
      });

      // Clear the cipher cache to clear the deleted collection from the cipher state
      await this.cipherService.clear();

      // Navigate away if we deleted the collection we were viewing
      const selectedCollection = await firstValueFrom(this.selectedCollection$);
      if (selectedCollection?.node.id === collection.id) {
        void this.router.navigate([], {
          queryParams: { collectionId: selectedCollection?.parent?.node.id ?? null },
          queryParamsHandling: "merge",
          replaceUrl: true,
        });
      }

      this.refresh();
    } catch (e) {
      this.logService.error(e);
    }
  }

  async bulkEditCollectionAccess(
    collections: CollectionView[],
    organization: Organization,
  ): Promise<void> {
    if (collections.length === 0) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("noCollectionsSelected"),
      });
      return;
    }

    if (collections.some((c) => !c.canEdit(organization))) {
      this.showMissingPermissionsError();
      return;
    }

    const org = await firstValueFrom(this.organization$);
    const dialog = BulkCollectionsDialogComponent.open(this.dialogService, {
      data: {
        collections,
        organizationId: org.id,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result === BulkCollectionsDialogResult.Saved) {
      this.refresh();
    }
  }

  private showMissingPermissionsError(): void {
    this.toastService.showToast({
      variant: "error",
      message: this.i18nService.t("missingPermissions"),
    });
  }
}
