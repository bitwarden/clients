// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import {
  catchError,
  combineLatest,
  concatMap,
  from,
  map,
  Observable,
  of,
  shareReplay,
  Subject,
  switchMap,
  takeUntil,
} from "rxjs";

import {
  CollectionAdminService,
  CollectionAdminView,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";

import { InternalGroupApiService as GroupService } from "../core";
import {
  AccessItemType,
  AccessItemValue,
  AccessItemView,
  convertToPermission,
  convertToSelectionView,
  PermissionMode,
} from "../shared/components/access-selector";

import { AddEditGroupDetail } from "./../core/views/add-edit-group-detail";

/**
 * Indices for the available tabs in the dialog
 */
// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum GroupAddEditTabType {
  Info = 0,
  Members = 1,
  Collections = 2,
}

export interface GroupAddEditDialogParams {
  /**
   * ID of the organization the group belongs to
   */
  organizationId: string;

  /**
   * Optional ID of the group being modified
   */
  groupId?: string;

  /**
   * Tab to open when the dialog is open.
   * Defaults to Group Info
   */
  initialTab?: GroupAddEditTabType;
}

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum GroupAddEditDialogResultType {
  Saved = "saved",
  Canceled = "canceled",
  Deleted = "deleted",
}

/**
 * Strongly typed helper to open a groupAddEditDialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Configuration for the dialog
 */
export const openGroupAddEditDialog = (
  dialogService: DialogService,
  config: DialogConfig<GroupAddEditDialogParams>,
) => {
  return dialogService.open<GroupAddEditDialogResultType, GroupAddEditDialogParams>(
    GroupAddEditComponent,
    config,
  );
};

@Component({
  selector: "app-group-add-edit",
  templateUrl: "group-add-edit.component.html",
  standalone: false,
})
export class GroupAddEditComponent implements OnInit, OnDestroy {
  private organization$ = this.accountService.activeAccount$.pipe(
    switchMap((account) =>
      this.organizationService
        .organizations$(account?.id)
        .pipe(getOrganizationById(this.organizationId))
        .pipe(shareReplay({ refCount: true })),
    ),
  );

  protected PermissionMode = PermissionMode;
  protected ResultType = GroupAddEditDialogResultType;

  tabIndex: GroupAddEditTabType;
  loading = true;
  title: string;
  collections: AccessItemView[] = [];
  members: Array<AccessItemView & { userId: UserId }> = [];
  group: AddEditGroupDetail;

  groupForm = this.formBuilder.group({
    name: ["", [Validators.required, Validators.maxLength(100)]],
    externalId: this.formBuilder.control({ value: "", disabled: true }),
    members: [[] as AccessItemValue[]],
    collections: [[] as AccessItemValue[]],
  });

  get groupId(): string | undefined {
    return this.params.groupId;
  }

  get organizationId(): string {
    return this.params.organizationId;
  }

  protected get isExternalIdVisible(): boolean {
    return !!this.groupForm.get("externalId")?.value;
  }

  protected get editMode(): boolean {
    return this.groupId != null;
  }

  private destroy$ = new Subject<void>();

  private orgCollections$ = from(this.collectionAdminService.getAll(this.organizationId)).pipe(
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  private get orgMembers$(): Observable<Array<AccessItemView & { userId: UserId }>> {
    return from(this.organizationUserApiService.getAllMiniUserDetails(this.organizationId)).pipe(
      map((response) =>
        response.data.map((m) => ({
          id: m.id,
          type: AccessItemType.Member,
          email: m.email,
          role: m.type,
          listName: m.name?.length > 0 ? `${m.name} (${m.email})` : m.email,
          labelName: m.name || m.email,
          status: m.status,
          userId: m.userId as UserId,
        })),
      ),
    );
  }

  private groupDetails$: Observable<AddEditGroupDetail | undefined> = of(this.editMode).pipe(
    concatMap((editMode) => {
      if (!editMode) {
        return of(undefined);
      }

      return combineLatest([
        this.groupService.get(this.organizationId, this.groupId),
        this.apiService.getGroupUsers(this.organizationId, this.groupId),
      ]).pipe(
        map(([groupView, users]): AddEditGroupDetail => {
          return {
            ...groupView,
            members: users,
          };
        }),
        catchError((e: unknown) => {
          if (e instanceof ErrorResponse) {
            this.logService.error(e.message);
          } else {
            this.logService.error(e.toString());
          }
          return of(undefined);
        }),
      );
    }),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  protected allowAdminAccessToAllCollectionItems$ = this.organization$.pipe(
    map((organization) => {
      return organization.allowAdminAccessToAllCollectionItems;
    }),
  );

  protected canAssignAccessToAnyCollection$ = combineLatest([
    this.organization$,
    this.allowAdminAccessToAllCollectionItems$,
  ]).pipe(
    map(
      ([org, allowAdminAccessToAllCollectionItems]) =>
        org.canEditAnyCollection ||
        // Manage Groups custom permission cannot edit any collection but they can assign access from this dialog
        // if permitted by collection management settings
        (org.permissions.manageGroups && allowAdminAccessToAllCollectionItems),
    ),
  );

  protected cannotAddSelfToGroup$ = combineLatest([
    this.allowAdminAccessToAllCollectionItems$,
    this.groupDetails$,
  ]).pipe(map(([allowAdminAccess, groupDetails]) => !allowAdminAccess && groupDetails != null));

  constructor(
    @Inject(DIALOG_DATA) private params: GroupAddEditDialogParams,
    private dialogRef: DialogRef<GroupAddEditDialogResultType>,
    private apiService: ApiService,
    private organizationUserApiService: OrganizationUserApiService,
    private groupService: GroupService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private logService: LogService,
    private formBuilder: FormBuilder,
    private changeDetectorRef: ChangeDetectorRef,
    private dialogService: DialogService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private collectionAdminService: CollectionAdminService,
    private toastService: ToastService,
    private configService: ConfigService,
  ) {
    this.tabIndex = params.initialTab ?? GroupAddEditTabType.Info;
  }

  ngOnInit() {
    this.loading = true;
    this.title = this.i18nService.t(this.editMode ? "editGroup" : "newGroup");

    combineLatest([
      this.orgCollections$,
      this.orgMembers$,
      this.groupDetails$,
      this.cannotAddSelfToGroup$,
      this.accountService.activeAccount$,
      this.organization$,
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        ([collections, members, group, restrictGroupAccess, activeAccount, organization]) => {
          this.members = members;
          this.group = group;
          this.collections = mapToAccessItemViews(collections, organization, group);

          if (this.group != undefined) {
            // Must detect changes so that AccessSelector @Inputs() are aware of the latest
            // collections/members set above, otherwise no selected values will be patched below
            this.changeDetectorRef.detectChanges();

            this.groupForm.patchValue({
              name: this.group.name,
              externalId: this.group.externalId,
              members: this.group.members.map((m) => ({
                id: m,
                type: AccessItemType.Member,
              })),
              collections: mapToAccessSelections(group, this.collections),
            });
          }

          // If the current user is not already in the group and cannot add themselves, remove them from the list
          if (restrictGroupAccess) {
            // organizationUserId may be null if accessing via a provider
            const organizationUserId = this.members.find((m) => m.userId === activeAccount.id)?.id;
            const isAlreadyInGroup = this.groupForm.value.members.some(
              (m) => m.id === organizationUserId,
            );

            if (organizationUserId != null && !isAlreadyInGroup) {
              this.members = this.members.filter((m) => m.id !== organizationUserId);
            }
          }

          this.loading = false;
        },
      );
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit = async () => {
    this.groupForm.markAllAsTouched();

    if (this.groupForm.invalid) {
      if (this.tabIndex !== GroupAddEditTabType.Info) {
        this.toastService.showToast({
          variant: "error",
          title: null,
          message: this.i18nService.t(
            "fieldOnTabRequiresAttention",
            this.i18nService.t("groupInfo"),
          ),
        });
      }
      return;
    }

    const formValue = this.groupForm.value;

    const groupView: AddEditGroupDetail = {
      id: this.groupId,
      organizationId: this.organizationId,
      name: formValue.name,
      members: formValue.members?.map((m) => m.id) ?? [],
      collections: formValue.collections.map((c) => convertToSelectionView(c)),
      externalId: formValue.externalId,
    };

    await this.groupService.save(groupView);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t(
        this.editMode ? "editedGroupId" : "createdGroupId",
        formValue.name,
      ),
    });

    this.dialogRef.close(GroupAddEditDialogResultType.Saved);
  };

  delete = async () => {
    if (!this.editMode) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: this.group.name,
      content: { key: "deleteGroupConfirmation" },
      type: "warning",
    });
    if (!confirmed) {
      return false;
    }

    await this.groupService.delete(this.organizationId, this.groupId);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("deletedGroupId", this.group.name),
    });
    this.dialogRef.close(GroupAddEditDialogResultType.Deleted);
  };
}

/**
 * Maps the group's current collection access to AccessItemValues to populate the access-selector's FormControl
 */
function mapToAccessSelections(
  group: AddEditGroupDetail,
  items: AccessItemView[],
): AccessItemValue[] {
  return (
    group.collections
      // The FormControl value only represents editable collection access - exclude readonly access selections
      .filter((selection) => !items.find((item) => item.id == selection.id).readonly)
      .map((gc) => ({
        id: gc.id,
        type: AccessItemType.Collection,
        permission: convertToPermission(gc),
      }))
  );
}

/**
 * Maps the organization's collections to AccessItemViews to populate the access-selector's multi-select
 */
function mapToAccessItemViews(
  collections: CollectionAdminView[],
  organization: Organization,
  group?: AddEditGroupDetail,
): AccessItemView[] {
  return (
    collections
      .map<AccessItemView>((c) => {
        const accessSelection = group?.collections.find((access) => access.id == c.id) ?? undefined;
        return {
          id: c.id,
          type: AccessItemType.Collection,
          labelName: c.name,
          listName: c.name,
          readonly: !c.canEditGroupAccess(organization),
          readonlyPermission: accessSelection ? convertToPermission(accessSelection) : undefined,
        };
      })
      // Remove any collection views that are not already assigned and that we don't have permissions to assign access to
      .filter((item) => !item.readonly || group?.collections.some((access) => access.id == item.id))
  );
}
