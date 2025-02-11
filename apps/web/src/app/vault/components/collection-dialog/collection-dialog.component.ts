// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { AbstractControl, FormBuilder, Validators } from "@angular/forms";
import {
  combineLatest,
  firstValueFrom,
  map,
  Observable,
  of,
  shareReplay,
  Subject,
  switchMap,
  takeUntil,
} from "rxjs";
import { first } from "rxjs/operators";

import {
  CollectionAccessSelectionView,
  CollectionAdminService,
  CollectionAdminView,
  OrganizationUserApiService,
  OrganizationUserUserMiniResponse,
  CollectionResponse,
  CollectionView,
} from "@bitwarden/admin-console/common";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { BitValidators, DialogService, ToastService } from "@bitwarden/components";

import { GroupApiService, GroupView } from "../../../admin-console/organizations/core";
import { PermissionMode } from "../../../admin-console/organizations/shared/components/access-selector/access-selector.component";
import {
  AccessItemType,
  AccessItemValue,
  AccessItemView,
  CollectionPermission,
  convertToPermission,
  convertToSelectionView,
} from "../../../admin-console/organizations/shared/components/access-selector/access-selector.models";

export enum CollectionDialogTabType {
  Info = 0,
  Access = 1,
}

export interface CollectionDialogParams {
  collectionId?: string;
  organizationId: string;
  initialTab?: CollectionDialogTabType;
  parentCollectionId?: string;
  showOrgSelector?: boolean;
  /**
   * Flag to limit the nested collections to only those the user has explicit CanManage access too.
   */
  limitNestedCollections?: boolean;
  readonly?: boolean;
  isAddAccessCollection?: boolean;
}

export interface CollectionDialogResult {
  action: CollectionDialogAction;
  collection: CollectionResponse | CollectionView;
}

export enum CollectionDialogAction {
  Saved = "saved",
  Canceled = "canceled",
  Deleted = "deleted",
}

@Component({
  templateUrl: "collection-dialog.component.html",
})
export class CollectionDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  protected organizations$: Observable<Organization[]>;

  protected tabIndex: CollectionDialogTabType;
  protected loading = true;
  protected organization?: Organization;
  protected collection?: CollectionAdminView;
  protected nestOptions: CollectionView[] = [];
  protected accessItems: AccessItemView[] = [];
  protected deletedParentName: string | undefined;
  protected showOrgSelector = false;
  protected formGroup = this.formBuilder.group({
    name: ["", [Validators.required, BitValidators.forbiddenCharacters(["/"])]],
    externalId: "",
    parent: undefined as string | undefined,
    access: [[] as AccessItemValue[]],
    selectedOrg: "",
  });
  protected PermissionMode = PermissionMode;
  protected showDeleteButton = false;
  protected showAddAccessWarning = false;

  constructor(
    @Inject(DIALOG_DATA) private params: CollectionDialogParams,
    private formBuilder: FormBuilder,
    private dialogRef: DialogRef<CollectionDialogResult>,
    private organizationService: OrganizationService,
    private groupService: GroupApiService,
    private collectionAdminService: CollectionAdminService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private organizationUserApiService: OrganizationUserApiService,
    private dialogService: DialogService,
    private changeDetectorRef: ChangeDetectorRef,
    private accountService: AccountService,
    private toastService: ToastService,
  ) {
    this.tabIndex = params.initialTab ?? CollectionDialogTabType.Info;
  }

  async ngOnInit() {
    // Opened from the individual vault
    if (this.params.showOrgSelector) {
      this.showOrgSelector = true;
      this.formGroup.controls.selectedOrg.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((id) => this.loadOrg(id));
      const userId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      this.organizations$ = this.organizationService.organizations$(userId).pipe(
        first(),
        map((orgs) =>
          orgs
            .filter((o) => o.canCreateNewCollections && !o.isProviderUser)
            .sort(Utils.getSortFunction(this.i18nService, "name")),
        ),
      );
      // patchValue will trigger a call to loadOrg() in this case, so no need to call it again here
      this.formGroup.patchValue({ selectedOrg: this.params.organizationId });
    } else {
      // Opened from the org vault
      this.formGroup.patchValue({ selectedOrg: this.params.organizationId });
      await this.loadOrg(this.params.organizationId);
    }
  }

  async loadOrg(orgId: string) {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const organization$ = this.organizationService
      .organizations$(userId)
      .pipe(getOrganizationById(orgId))
      .pipe(shareReplay({ refCount: true, bufferSize: 1 }));
    const groups$ = organization$.pipe(
      switchMap((organization) => {
        if (!organization.useGroups) {
          return of([] as GroupView[]);
        }

        return this.groupService.getAll(orgId);
      }),
    );
    combineLatest({
      organization: organization$,
      collections: this.collectionAdminService.getAll(orgId),
      groups: groups$,
      users: this.organizationUserApiService.getAllMiniUserDetails(orgId),
    })
      .pipe(takeUntil(this.formGroup.controls.selectedOrg.valueChanges), takeUntil(this.destroy$))
      .subscribe(({ organization, collections: allCollections, groups, users }) => {
        this.organization = organization;

        if (this.params.collectionId) {
          this.collection = allCollections.find((c) => c.id === this.collectionId);

          if (!this.collection) {
            throw new Error("Could not find collection to edit.");
          }
        }

        this.accessItems = [].concat(
          groups.map((group) => mapGroupToAccessItemView(group, this.collection)),
          users.data.map((user) => mapUserToAccessItemView(user, this.collection)),
        );

        // Force change detection to update the access selector's items
        this.changeDetectorRef.detectChanges();

        this.nestOptions = this.params.limitNestedCollections
          ? allCollections.filter((c) => c.manage)
          : allCollections;

        if (this.collection) {
          // Ensure we don't allow nesting the current collection within itself
          this.nestOptions = this.nestOptions.filter((c) => c.id !== this.collectionId);

          // Parse the name to find its parent name
          const { name, parent: parentName } = parseName(this.collection);

          // Determine if the user can see/select the parent collection
          if (parentName !== undefined) {
            if (
              this.organization.canViewAllCollections &&
              !allCollections.find((c) => c.name === parentName)
            ) {
              // The user can view all collections, but the parent was not found -> assume it has been deleted
              this.deletedParentName = parentName;
            } else if (!this.nestOptions.find((c) => c.name === parentName)) {
              // We cannot find the current parent collection in our list of options, so add a placeholder
              this.nestOptions.unshift({ name: parentName } as CollectionView);
            }
          }

          const accessSelections = mapToAccessSelections(this.collection);
          this.formGroup.patchValue({
            name,
            externalId: this.collection.externalId,
            parent: parentName,
            access: accessSelections,
          });
          this.showDeleteButton = !this.dialogReadonly && this.collection.canDelete(organization);
        } else {
          const parent = this.nestOptions.find((c) => c.id === this.params.parentCollectionId);
          const currentOrgUserId = users.data.find(
            (u) => u.userId === this.organization?.userId,
          )?.id;
          const initialSelection: AccessItemValue[] =
            currentOrgUserId !== undefined
              ? [
                  {
                    id: currentOrgUserId,
                    type: AccessItemType.Member,
                    permission: CollectionPermission.Manage,
                  },
                ]
              : [];

          this.formGroup.patchValue({
            parent: parent?.name ?? undefined,
            access: initialSelection,
          });
        }

        if (!organization.allowAdminAccessToAllCollectionItems) {
          this.formGroup.controls.access.addValidators(validateCanManagePermission);
        } else {
          this.formGroup.controls.access.removeValidators(validateCanManagePermission);
        }
        this.formGroup.controls.access.updateValueAndValidity();

        this.handleFormGroupReadonly(this.dialogReadonly);

        this.loading = false;
        this.showAddAccessWarning = this.handleAddAccessWarning();
      });
  }

  protected get collectionId() {
    return this.params.collectionId;
  }

  protected get editMode() {
    return this.params.collectionId != undefined;
  }

  protected get dialogReadonly() {
    return this.params.readonly === true;
  }

  protected async cancel() {
    this.close(CollectionDialogAction.Canceled);
  }

  protected submit = async () => {
    // Saving a collection is prohibited while in read only mode
    if (this.dialogReadonly) {
      return;
    }

    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      const accessTabError = this.formGroup.controls.access.hasError("managePermissionRequired");

      if (this.tabIndex === CollectionDialogTabType.Access && !accessTabError) {
        this.toastService.showToast({
          variant: "error",
          title: null,
          message: this.i18nService.t(
            "fieldOnTabRequiresAttention",
            this.i18nService.t("collectionInfo"),
          ),
        });
      } else if (this.tabIndex === CollectionDialogTabType.Info && accessTabError) {
        this.toastService.showToast({
          variant: "error",
          title: null,
          message: this.i18nService.t("fieldOnTabRequiresAttention", this.i18nService.t("access")),
        });
      }
      return;
    }

    const collectionView = new CollectionAdminView();
    collectionView.id = this.params.collectionId;
    collectionView.organizationId = this.formGroup.controls.selectedOrg.value;
    collectionView.externalId = this.formGroup.controls.externalId.value;
    collectionView.groups = this.formGroup.controls.access.value
      .filter((v) => v.type === AccessItemType.Group)
      .map(convertToSelectionView);
    collectionView.users = this.formGroup.controls.access.value
      .filter((v) => v.type === AccessItemType.Member)
      .map(convertToSelectionView);

    const parent = this.formGroup.controls.parent.value;
    if (parent) {
      collectionView.name = `${parent}/${this.formGroup.controls.name.value}`;
    } else {
      collectionView.name = this.formGroup.controls.name.value;
    }

    const savedCollection = await this.collectionAdminService.save(collectionView);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t(
        this.editMode ? "editedCollectionId" : "createdCollectionId",
        collectionView.name,
      ),
    });

    this.close(CollectionDialogAction.Saved, savedCollection);
  };

  protected delete = async () => {
    // Deleting a collection is prohibited while in read only mode
    if (this.dialogReadonly) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: this.collection?.name,
      content: { key: "deleteCollectionConfirmation" },
      type: "warning",
    });

    if (!confirmed && this.params.collectionId) {
      return false;
    }

    await this.collectionAdminService.delete(this.params.organizationId, this.params.collectionId);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("deletedCollectionId", this.collection?.name),
    });

    this.close(CollectionDialogAction.Deleted, this.collection);
  };

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private handleAddAccessWarning(): boolean {
    if (
      !this.organization?.allowAdminAccessToAllCollectionItems &&
      this.params.isAddAccessCollection
    ) {
      return true;
    }

    return false;
  }

  private handleFormGroupReadonly(readonly: boolean) {
    if (readonly) {
      this.formGroup.controls.name.disable();
      this.formGroup.controls.externalId.disable();
      this.formGroup.controls.parent.disable();
      this.formGroup.controls.access.disable();
    } else {
      this.formGroup.controls.name.enable();
      this.formGroup.controls.externalId.enable();
      this.formGroup.controls.parent.enable();
      this.formGroup.controls.access.enable();
    }
  }

  private close(action: CollectionDialogAction, collection?: CollectionResponse | CollectionView) {
    this.dialogRef.close({ action, collection } as CollectionDialogResult);
  }
}

function parseName(collection: CollectionView) {
  const nameParts = collection.name?.split("/");
  const name = nameParts[nameParts.length - 1];
  const parent = nameParts.length > 1 ? nameParts.slice(0, -1).join("/") : undefined;

  return { name, parent };
}

function mapToAccessSelections(collectionDetails: CollectionAdminView): AccessItemValue[] {
  if (collectionDetails == undefined) {
    return [];
  }
  return [].concat(
    collectionDetails.groups.map<AccessItemValue>((selection) => ({
      id: selection.id,
      type: AccessItemType.Group,
      permission: convertToPermission(selection),
    })),
    collectionDetails.users.map<AccessItemValue>((selection) => ({
      id: selection.id,
      type: AccessItemType.Member,
      permission: convertToPermission(selection),
    })),
  );
}

/**
 * Validator to ensure that at least one access item has Manage permission
 */
function validateCanManagePermission(control: AbstractControl) {
  const access = control.value as AccessItemValue[];
  const hasManagePermission = access.some((a) => a.permission === CollectionPermission.Manage);

  return hasManagePermission ? null : { managePermissionRequired: true };
}

/**
 *
 * @param group Current group being used to translate object into AccessItemView
 * @param collectionId Current collection being viewed/edited
 * @returns AccessItemView customized to set a readonlyPermission to be displayed if the access selector is in a disabled state
 */
function mapGroupToAccessItemView(
  group: GroupView,
  collection: CollectionAdminView,
): AccessItemView {
  return {
    id: group.id,
    type: AccessItemType.Group,
    listName: group.name,
    labelName: group.name,
    readonly: false,
    readonlyPermission:
      collection != null
        ? convertToPermission(collection.groups.find((g) => g.id === group.id))
        : undefined,
  };
}

/**
 *
 * @param user Current user being used to translate object into AccessItemView
 * @param collectionId Current collection being viewed/edited
 * @returns AccessItemView customized to set a readonlyPermission to be displayed if the access selector is in a disabled state
 */
function mapUserToAccessItemView(
  user: OrganizationUserUserMiniResponse,
  collection: CollectionAdminView,
): AccessItemView {
  return {
    id: user.id,
    type: AccessItemType.Member,
    email: user.email,
    role: user.type,
    listName: user.name?.length > 0 ? `${user.name} (${user.email})` : user.email,
    labelName: user.name ?? user.email,
    status: user.status,
    readonly: false,
    readonlyPermission:
      collection != null
        ? convertToPermission(
            new CollectionAccessSelectionView(collection.users.find((u) => u.id === user.id)),
          )
        : undefined,
  };
}

/**
 * Strongly typed helper to open a CollectionDialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Configuration for the dialog
 */
export function openCollectionDialog(
  dialogService: DialogService,
  config: DialogConfig<CollectionDialogParams>,
) {
  return dialogService.open<CollectionDialogResult, CollectionDialogParams>(
    CollectionDialogComponent,
    config,
  );
}
