import { SelectionModel } from "@angular/cdk/collections";
import { computed, inject, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import {
  combineLatest,
  distinctUntilChanged,
  firstValueFrom,
  lastValueFrom,
  map,
  of,
  startWith,
  Subject,
  switchMap,
} from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView, Unassigned } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  BulkMoveDialogResult,
  openBulkMoveDialog,
} from "../components/bulk-action-dialogs/bulk-move-dialog/bulk-move-dialog.component";
import { VaultItem } from "../components/vault-item";
import { All } from "../models/routed-vault-filter.model";
import {
  ASSIGN_COLLECTIONS_DIALOG,
  AssignCollectionsDialogRef,
  AssignCollectionsResult,
} from "../tokens/assign-collections-dialog.token";
import {
  BULK_DELETE_DIALOG,
  BulkDeleteDialogRef,
  BulkDeleteDialogResult,
} from "../tokens/bulk-delete-dialog.token";

import { PasswordRepromptService } from "./password-reprompt.service";
import { RoutedVaultFilterBridgeService } from "./routed-vault-filter-bridge.service";
import { RoutedVaultFilterService } from "./routed-vault-filter.service";

/** Context provided by the host vault component to drive permission checks and action availability. */
export interface VaultBatchBarConfig {
  /** When true when operating inside an org vault view. Enables admin API paths and org-specific permission checks. */
  isOrgVault: boolean;
  /** All collections visible in the current vault context, used for assign-to-collection eligibility. */
  allCollections: CollectionView[];
  /** When true, when the current vault filter has at least one cipher in the list. */
  hasCiphers: boolean;
  /** Should be populated when isOrgVault is true. Used to apply org-specific permission checks and admin API paths. */
  organization?: Organization;
}

/**
 * Manages selection state and bulk actions for vault items (ciphers and collections).
 *
 * Provide this service at the "Vault" component level — it is **not** `providedIn: 'root'`.
 *
 * **Setup**
 *
 * 1. Provide the service in the "Vault" component's `providers` array.
 * 2. Call {@link setConfig} (e.g. in `ngOnChanges`) whenever the vault context changes so that
 *    permission signals stay up-to-date.
 * 3. Bind the `can*` signals to button visibility/disabled state in the host template.
 * 4. Subscribe to {@link completed$} to react to successful bulk operations (e.g. refresh the list).
 */
@Injectable()
export class VaultBatchBarService<C extends CipherViewLike> {
  private readonly cipherService = inject(CipherService);
  private readonly cipherArchiveService = inject(CipherArchiveService);
  private readonly cipherAuthorizationService = inject(CipherAuthorizationService);
  private readonly organizationService = inject(OrganizationService);
  private readonly passwordRepromptService = inject(PasswordRepromptService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly accountService = inject(AccountService);
  private readonly routedVaultFilterBridgeService = inject(RoutedVaultFilterBridgeService);
  private readonly routedVaultFilterService = inject(RoutedVaultFilterService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly configService = inject(ConfigService);
  private readonly assignCollectionsDialog =
    inject<AssignCollectionsDialogRef>(ASSIGN_COLLECTIONS_DIALOG);
  private readonly bulkDeleteDialog = inject<BulkDeleteDialogRef>(BULK_DELETE_DIALOG);

  private readonly defaultConfig: VaultBatchBarConfig = {
    isOrgVault: false,
    allCollections: [],
    hasCiphers: false,
  };

  private readonly config = signal<VaultBatchBarConfig>(this.defaultConfig);

  readonly inTrash = toSignal(
    this.routedVaultFilterService.filter$.pipe(map((f) => f.type === "trash")),
    { initialValue: false },
  );

  private readonly showBulkAddToFolder = computed(
    () => !this.inTrash() && !this.config().isOrgVault,
  );

  private readonly allOrganizations = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.organizationService.organizations$(userId)),
    ),
    { initialValue: [] as Organization[] },
  );

  private readonly userCanArchive = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.cipherArchiveService.userCanArchive$(userId)),
    ),
    { initialValue: false },
  );

  /** The Angular CDK selection model. Add, remove, or clear items directly. */
  readonly selection = new SelectionModel<VaultItem<C>>(true, [], true);

  private readonly _completed$ = new Subject<void>();
  /** Emits once after each successful bulk action. Subscribe to trigger a list refresh. */
  readonly completed$ = this._completed$.asObservable();

  private readonly selectionChanged = toSignal(this.selection.changed.pipe(startWith(null)));

  /** Signal of all currently selected vault items. */
  readonly selected = computed(() => {
    this.selectionChanged();
    return this.selection.selected;
  });

  readonly selectedCount = computed(() => this.selected().length);

  private readonly batchBarFlag = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PM37785_VaultBatchBar),
    { initialValue: false },
  );

  /** True when the batch bar feature flag is enabled. */
  readonly enabled = computed(() => this.batchBarFlag());

  /** True when the batch bar is actively visible: feature flag on and at least one item selected. */
  readonly barVisible = computed(() => this.batchBarFlag() && this.selectedCount() > 0);

  /** Selected items that are ciphers. */
  readonly selectedCiphers = computed(() =>
    this.selected()
      .filter((i) => i.cipher !== undefined)
      .map((i) => i.cipher as C),
  );

  /** Selected items that are collections. */
  readonly selectedCollections = computed(() =>
    this.selected()
      .filter((i) => i.collection !== undefined)
      .map((i) => i.collection as CollectionView),
  );

  /** True when bulk add-to-folder is allowed. */
  readonly canAddToFolder = computed(() => {
    const selected = this.selected();
    return (
      this.showBulkAddToFolder() &&
      selected.length !== 0 &&
      selected.filter((item) => item.collection).length === 0
    );
  });

  /** True when all selected ciphers can be archived. */
  readonly canArchive = computed(() => {
    const selected = this.selected();
    const hasCollections = selected.some((i) => i.collection);
    if (selected.length === 0 || !this.userCanArchive() || hasCollections || this.inTrash()) {
      return false;
    }
    return !selected.find(
      (item) => item.cipher && (item.cipher.organizationId || item.cipher.archivedDate),
    );
  });

  /** True when all selected ciphers can be unarchived. */
  readonly canUnarchive = computed(() => {
    const selected = this.selected();
    if (selected.length === 0 || this.inTrash()) {
      return false;
    }
    return !selected.find((i) => !i.cipher?.archivedDate || i.cipher?.organizationId);
  });

  /** True when all selected ciphers can be restored from trash. */
  readonly canRestore = toSignal(
    combineLatest([
      this.selection.changed.pipe(startWith(null)),
      toObservable(this.config),
      toObservable(this.inTrash),
    ]).pipe(
      switchMap(([, config, inTrash]) => {
        const selected = this.selection.selected;
        const ciphers = selected.filter((i) => i.cipher).map((i) => i.cipher as C);

        if (selected.length === 0) {
          return of(true);
        }

        if (ciphers.length === 0) {
          return of(false);
        }

        const canRestoreCiphers$ = ciphers.map((c) =>
          this.cipherAuthorizationService.canRestoreCipher$(c, config.isOrgVault),
        );

        return combineLatest(canRestoreCiphers$).pipe(
          map((results) => results.every((r) => r) && inTrash),
        );
      }),
    ),
    { initialValue: true },
  );

  /** True when all selected ciphers and collections can be deleted by the current user. */
  readonly canDelete = toSignal(
    combineLatest([
      this.selection.changed.pipe(startWith(null)),
      toObservable(this.config),
      toObservable(this.allOrganizations),
    ]).pipe(
      switchMap(([, config, allOrganizations]) => {
        const selected = this.selection.selected;

        if (selected.length === 0) {
          return of(true);
        }

        const ciphers = selected.filter((i) => i.cipher).map((i) => i.cipher as C);
        const collections = selected
          .filter((i) => i.collection)
          .map((i) => i.collection as CollectionView);

        const canDeleteCollections = collections.every((c) => {
          if (c.id === Unassigned) {
            return false;
          }
          const org = allOrganizations.find((o) => o.id === c.organizationId);
          return c.canDelete(org);
        });

        if (ciphers.length === 0) {
          return of(canDeleteCollections);
        }

        const canDeleteCiphers$ = ciphers.map((c) =>
          this.cipherAuthorizationService.canDeleteCipher$(c, config.isOrgVault),
        );

        return combineLatest(canDeleteCiphers$).pipe(
          map((results) => results.every((r) => r) && canDeleteCollections),
        );
      }),
    ),
    { initialValue: true },
  );

  /**
   * True when the selected ciphers can be assigned to collections.
   */
  readonly canAssignToCollections = computed(() => {
    const config = this.config();
    const allOrganizations = this.allOrganizations();
    const selected = this.selected();
    const selectedCiphers = selected.filter((i) => i.cipher).map((i) => i.cipher as C);
    const anyArchived = selectedCiphers.some((c) => CipherViewLikeUtils.isArchived(c));

    // Archived ciphers cannot be reassigned; block the action entirely if any are present.
    const bulkAssignAllowed = config.hasCiphers && !anyArchived;

    if (!bulkAssignAllowed) {
      return false;
    }

    // Org-vault admins can assign any cipher to a collection without further checks, `isOrgVault` should
    // only be true when the user is within the Admin Console.
    if (config.isOrgVault && selected.length !== 0) {
      return true;
    }

    // Baseline checks:
    // - Cannot assign ciphers when viewing the trash
    // - An org membership is required
    // - At least one cipher must be selected
    if (this.inTrash() || allOrganizations.length === 0 || selected.length === 0) {
      return false;
    }

    const hasPersonalItems = selectedCiphers.some((c) => !c.organizationId);
    const uniqueOrgIds = new Set(
      selectedCiphers.flatMap((c) => c.organizationId ?? null).filter(Boolean),
    );
    const hasEditableCollections = config.allCollections.some((c) => !c.readOnly);

    // Assigning ciphers from multiple orgs at once cannot be done.
    if (uniqueOrgIds.size > 1) {
      return false;
    }

    // Personal (non-org) ciphers: allow if there is at least one editable collection to target.
    if (uniqueOrgIds.size === 0 && hasEditableCollections) {
      return hasPersonalItems;
    }

    const [orgId] = uniqueOrgIds;
    const org = allOrganizations.find((o) => o.id === orgId);
    const canEditOrManageAll = org?.canEditAllCiphers === true;
    const collectionNotSelected = selected.filter((i) => i.collection).length === 0;
    const allCiphersHaveEdit = selectedCiphers.every((c) => c.edit && c.viewPassword);

    return (
      (canEditOrManageAll || allCiphersHaveEdit) && collectionNotSelected && hasEditableCollections
    );
  });

  constructor() {
    this.routedVaultFilterService.filter$
      .pipe(
        distinctUntilChanged(
          (prev, curr) =>
            prev.organizationId === curr.organizationId &&
            prev.collectionId === curr.collectionId &&
            prev.folderId === curr.folderId &&
            prev.type === curr.type &&
            prev.organizationIdParamType === curr.organizationIdParamType,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.selection.clear();
      });
  }

  /** Update the vault context. Call in `ngOnChanges` or when configuration values change so permission signals stay current. */
  setConfig(config: VaultBatchBarConfig): void {
    this.config.set(config);
  }

  /** Archive the selected ciphers after confirmation. No-op if reprompt is cancelled. */
  async bulkArchive(): Promise<void> {
    const ciphers = this.selectedCiphers();

    if (!(await this.reprompt(ciphers))) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "archiveBulkItems" },
      content: { key: "archiveBulkItemsConfirmDesc" },
      type: "info",
    });

    if (!confirmed) {
      return;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const cipherIds = ciphers.map((c) => c.id as unknown as CipherId);
    try {
      await this.cipherArchiveService.archiveWithServer(cipherIds, userId);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("bulkArchiveItems"),
      });
      this.selection.clear();
      this._completed$.next();
    } catch (e) {
      this.logService.error("Error archiving ciphers", e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    }
  }

  /** Unarchive the selected ciphers. No-op if reprompt is cancelled. */
  async bulkUnarchive(): Promise<void> {
    const ciphers = this.selectedCiphers();

    if (!(await this.reprompt(ciphers))) {
      return;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const cipherIds = ciphers.map((c) => c.id as unknown as CipherId);
    try {
      await this.cipherArchiveService.unarchiveWithServer(cipherIds, userId);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("bulkUnarchiveItems"),
      });
      this.selection.clear();
      this._completed$.next();
    } catch (e) {
      this.logService.error("Error unarchiving ciphers", e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    }
  }

  /** Restore the selected ciphers from trash. Handles both org and personal vault paths. */
  async bulkRestore(): Promise<void> {
    const ciphers = this.selectedCiphers();
    const { isOrgVault, organization: org } = this.config();

    if (ciphers.length > 0) {
      const canRestoreAll = await firstValueFrom(
        combineLatest(
          ciphers.map((c) => this.cipherAuthorizationService.canRestoreCipher$(c, isOrgVault)),
        ).pipe(map((results) => results.every((r) => r))),
      );

      if (!canRestoreAll) {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("missingPermissions"),
        });
        return;
      }
    }

    const toastMessage = ciphers.some((c) => !CipherViewLikeUtils.isArchived(c))
      ? this.i18nService.t("restoredItems")
      : this.i18nService.t("archivedItemsRestored");

    if (!(await this.reprompt(ciphers))) {
      return;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    try {
      if (org != null) {
        const editAccessCiphers: string[] = [];
        const unassignedCiphers: string[] = [];

        if (org.canEditAllCiphers) {
          ciphers.forEach((c) => editAccessCiphers.push(uuidAsString(c.id as unknown as CipherId)));
        } else {
          ciphers.forEach((c) => {
            if (CipherViewLikeUtils.isUnassigned(c)) {
              unassignedCiphers.push(uuidAsString(c.id as unknown as CipherId));
            } else if (c.edit) {
              editAccessCiphers.push(uuidAsString(c.id as unknown as CipherId));
            }
          });
        }

        if (unassignedCiphers.length === 0 && editAccessCiphers.length === 0) {
          this.toastService.showToast({
            variant: "error",
            title: this.i18nService.t("errorOccurred"),
            message: this.i18nService.t("nothingSelected"),
          });
          return;
        }

        await this.cipherService.restoreManyWithServer(
          [...unassignedCiphers, ...editAccessCiphers],
          userId,
          org.id,
        );
      } else {
        const selectedCipherIds = ciphers.map((c) => uuidAsString(c.id as unknown as CipherId));
        if (selectedCipherIds.length === 0) {
          this.toastService.showToast({
            variant: "error",
            message: this.i18nService.t("nothingSelected"),
          });
          return;
        }
        await this.cipherService.restoreManyWithServer(selectedCipherIds, userId);
      }

      this.toastService.showToast({ variant: "success", message: toastMessage });
      this.selection.clear();
      this._completed$.next();
    } catch (e) {
      this.logService.error("Error restoring ciphers", e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    }
  }

  /**
   * Delete the selected ciphers and/or collections via the bulk-delete dialog.
   * Passes single-item arrays when only one item is selected — no special single-item path.
   * Performs a permanent delete when the current filter is the trash view.
   */
  async bulkDelete(): Promise<void> {
    const { isOrgVault, organization: org } = this.config();
    const selected = this.selection.selected;
    const ciphers = selected
      .filter((i) => i.collection === undefined && i.cipher !== undefined)
      .map((i) => i.cipher as C);
    const collections = selected
      .filter((i) => i.collection !== undefined)
      .map((i) => i.collection as CollectionView);

    if (!(await this.reprompt(ciphers))) {
      return;
    }

    if (ciphers.length === 0 && collections.length === 0) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("nothingSelected"),
      });
      return;
    }

    const permanent = this.inTrash();

    const orgIds = collections.map((c) => c.organizationId);
    const organizations = this.allOrganizations().filter((o) => orgIds.includes(o.id));

    const canDeleteCollections =
      collections.length === 0 ||
      collections.every((c) => {
        const collectionOrg = organizations.find((o) => o.id === c.organizationId);
        return c.canDelete(collectionOrg);
      });

    const canDeleteCiphers =
      ciphers.length === 0 ||
      (await firstValueFrom(
        combineLatest(
          ciphers.map((c) => this.cipherAuthorizationService.canDeleteCipher$(c, isOrgVault)),
        ).pipe(map((results) => results.every((r) => r))),
      ));

    if (!canDeleteCollections || !canDeleteCiphers) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("missingPermissions"),
      });
      return;
    }

    const unassignedCiphers =
      org != null
        ? ciphers
            .filter((c) => CipherViewLikeUtils.isUnassigned(c))
            .map((c) => uuidAsString(c.id as unknown as CipherId))
        : [];
    const assignedCipherIds =
      org != null
        ? ciphers
            .filter((c) => !CipherViewLikeUtils.isUnassigned(c))
            .map((c) => uuidAsString(c.id as unknown as CipherId))
        : ciphers.map((c) => uuidAsString(c.id as unknown as CipherId));

    const result = await this.bulkDeleteDialog.open({
      permanent,
      cipherIds: assignedCipherIds,
      organizations,
      collections,
      ...(org != null ? { organization: org, unassignedCiphers } : {}),
    });

    if (result === BulkDeleteDialogResult.Deleted) {
      this.selection.clear();
      this._completed$.next();
    }
  }

  /** Move the selected ciphers to a folder via the bulk-move dialog. */
  async bulkMoveToFolder(): Promise<void> {
    const ciphers = this.selectedCiphers();

    if (!(await this.reprompt(ciphers))) {
      return;
    }

    const selectedCipherIds = ciphers.map((c) => uuidAsString(c.id as unknown as CipherId));
    if (selectedCipherIds.length === 0) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("nothingSelected"),
      });
      return;
    }

    const dialog = openBulkMoveDialog(this.dialogService, {
      data: { cipherIds: selectedCipherIds },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result === BulkMoveDialogResult.Moved) {
      this.selection.clear();
      this._completed$.next();
    }
  }

  /**
   * Open the assign-collections dialog for the selected ciphers.
   * Derives the active collection and available collections from the current route filter.
   */
  async bulkAssignToCollections(): Promise<void> {
    const ciphers = this.selectedCiphers();

    if (!(await this.reprompt(ciphers))) {
      return;
    }

    if (ciphers.length === 0) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("nothingSelected"),
      });
      return;
    }

    const config = this.config();
    const filter = await firstValueFrom(this.routedVaultFilterBridgeService.activeFilter$);

    const { collectionId } = filter;
    const activeCollection =
      collectionId && collectionId !== All && collectionId !== Unassigned
        ? config.allCollections.find((c) => c.id === collectionId)
        : undefined;

    const orgId = filter.organizationId ?? ciphers.find((c) => !!c.organizationId)?.organizationId;

    let availableCollections: CollectionView[] = [];
    if (orgId && orgId !== "MyVault") {
      const org = this.allOrganizations().find((o) => o.id === orgId);
      availableCollections = config.allCollections.filter((c) => c.organizationId === org?.id);
    }

    // Convert CipherListView to CipherView if necessary
    let ciphersToAssign: CipherView[];
    if (ciphers.some(CipherViewLikeUtils.isCipherListView)) {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      ciphersToAssign = await firstValueFrom(
        this.cipherService
          .cipherViews$(userId)
          .pipe(
            map(
              (cipherViews) =>
                cipherViews.filter((cv) => ciphers.some((c) => c.id === cv.id)) as CipherView[],
            ),
          ),
      );
    } else {
      ciphersToAssign = ciphers as unknown as CipherView[];
    }

    const result = await this.assignCollectionsDialog.open({
      ciphers: ciphersToAssign,
      organizationId: orgId as OrganizationId,
      availableCollections,
      activeCollection,
      ...(config.organization != null && ciphersToAssign.length === 1
        ? {
            isSingleCipherAdmin:
              config.organization.canEditAllCiphers ||
              CipherViewLikeUtils.isUnassigned(ciphersToAssign[0]),
          }
        : {}),
    });

    if (result === AssignCollectionsResult.Saved) {
      this.selection.clear();
      this._completed$.next();
    }
  }

  private async reprompt(ciphers: CipherViewLike[]): Promise<boolean> {
    const notProtected = !ciphers.find((c) => c.reprompt !== CipherRepromptType.None);
    return notProtected || (await this.passwordRepromptService.showPasswordPrompt());
  }
}
