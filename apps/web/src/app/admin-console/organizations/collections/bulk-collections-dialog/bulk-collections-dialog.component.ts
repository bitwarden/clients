import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { combineLatest, of, Subject, switchMap, takeUntil } from "rxjs";

import {
  CollectionAdminService,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  CollectionAdminView,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { Vfo1I18nPipe, Vfo1TerminologyService } from "@bitwarden/vault";

import { SharedModule } from "../../../../shared";
import { GroupApiService, GroupView } from "../../core";
import {
  AccessItemType,
  AccessItemValue,
  AccessItemView,
  AccessSelectorModule,
  convertToPermission,
  convertToSelectionView,
  mapGroupToAccessItemView,
  mapUserToAccessItemView,
  PermissionMode,
} from "../../shared/components/access-selector";

export interface BulkCollectionsDialogParams {
  organizationId: string;
  collections: CollectionView[];
}

export const BulkCollectionsDialogResult = Object.freeze({
  Saved: "saved",
  Canceled: "canceled",
} as const);
export type BulkCollectionsDialogResult =
  (typeof BulkCollectionsDialogResult)[keyof typeof BulkCollectionsDialogResult];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SharedModule, AccessSelectorModule, Vfo1I18nPipe],
  selector: "app-bulk-collections-dialog",
  templateUrl: "bulk-collections-dialog.component.html",
})
export class BulkCollectionsDialogComponent implements OnDestroy {
  private readonly vfo1TerminologyService = inject(Vfo1TerminologyService);
  private readonly params = inject<BulkCollectionsDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<BulkCollectionsDialogResult>>(DialogRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly organizationService = inject(OrganizationService);
  private readonly accountService = inject(AccountService);
  private readonly groupService = inject(GroupApiService);
  private readonly organizationUserApiService = inject(OrganizationUserApiService);
  private readonly i18nService = inject(I18nService);
  private readonly collectionAdminService = inject(CollectionAdminService);
  private readonly toastService = inject(ToastService);
  private readonly configService = inject(ConfigService);

  protected readonly PermissionMode = PermissionMode;

  protected readonly formGroup = this.formBuilder.group({
    access: [[] as AccessItemValue[]],
  });
  protected readonly loading = signal(true);
  protected readonly organization = signal<Organization | undefined>(undefined);
  protected readonly accessItems = signal<AccessItemView[]>([]);
  protected readonly numCollections = this.params.collections.length;

  private readonly destroy$ = new Subject<void>();

  constructor() {
    const organization$ = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.organizationService
          .organizations$(userId)
          .pipe(getOrganizationById(this.params.organizationId)),
      ),
    );
    const groups$ = organization$.pipe(
      switchMap((organization) => {
        if (organization == null || !organization.useGroups) {
          return of([] as GroupView[]);
        }
        return this.groupService.getAll(organization.id);
      }),
    );
    const collections$ = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.collectionAdminService.collectionAdminViews$(this.params.organizationId, userId),
      ),
    );

    combineLatest([
      organization$,
      groups$,
      this.organizationUserApiService.getAllMiniUserDetails(this.params.organizationId),
      collections$,
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([organization, groups, users, collections]) => {
        this.organization.set(organization);

        this.accessItems.set([
          ...groups.map(mapGroupToAccessItemView),
          ...users.data.map(mapUserToAccessItemView),
        ]);

        const selectedIds = new Set(this.params.collections.map((c) => c.id));
        const selectedCollections = collections.filter((c) => selectedIds.has(c.id));
        this.formGroup.controls.access.setValue(sharedAccess(selectedCollections));

        this.loading.set(false);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  readonly submit = async () => {
    const organization = this.organization();
    if (organization == null) {
      return;
    }
    const accessValue = this.formGroup.controls.access.value ?? [];
    const users = accessValue
      .filter((v) => v.type === AccessItemType.Member)
      .map(convertToSelectionView);

    const groups = accessValue
      .filter((v) => v.type === AccessItemType.Group)
      .map(convertToSelectionView);

    await this.collectionAdminService.bulkAssignAccess(
      organization.id,
      this.params.collections.map((c) => c.id),
      users,
      groups,
    );

    const batchBarEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM37785_VaultBatchBar,
    );
    const vfo1Enabled = this.vfo1TerminologyService.enabled();
    const singular = vfo1Enabled ? "sharedFolderEdited" : "collectionEdited";
    const plural = vfo1Enabled ? "sharedFoldersEdited" : "collectionsEdited";
    const editedMessage = batchBarEnabled
      ? this.i18nService.t(this.params.collections.length === 1 ? singular : plural)
      : this.i18nService.t(plural);

    this.toastService.showToast({
      variant: "success",
      message: editedMessage,
    });

    await this.dialogRef.close(BulkCollectionsDialogResult.Saved);
  };

  static open(dialogService: DialogService, config: DialogConfig<BulkCollectionsDialogParams>) {
    return dialogService.open<BulkCollectionsDialogResult, BulkCollectionsDialogParams>(
      BulkCollectionsDialogComponent,
      config,
    );
  }
}

/**
 * Determines the access to pre-populate the selector with for the selected collections. A single
 * collection uses its own access; multiple collections only pre-populate when they all share the
 * exact same access, otherwise the selector starts empty.
 */
function sharedAccess(collections: CollectionAdminView[]): AccessItemValue[] {
  if (collections.length === 0) {
    return [];
  }

  const [first, ...rest] = collections.map(mapToAccessSelections);
  return rest.every((access) => accessEquals(first, access)) ? first : [];
}

function mapToAccessSelections(collection: CollectionAdminView): AccessItemValue[] {
  return [
    ...collection.groups.map<AccessItemValue>((selection) => ({
      id: selection.id,
      type: AccessItemType.Group,
      permission: convertToPermission(selection),
    })),
    ...collection.users.map<AccessItemValue>((selection) => ({
      id: selection.id,
      type: AccessItemType.Member,
      permission: convertToPermission(selection),
    })),
  ];
}

function accessEquals(a: AccessItemValue[], b: AccessItemValue[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const key = (value: AccessItemValue) => `${value.type}:${value.id}:${value.permission}`;
  const bKeys = new Set(b.map(key));
  return a.every((value) => bKeys.has(key(value)));
}
