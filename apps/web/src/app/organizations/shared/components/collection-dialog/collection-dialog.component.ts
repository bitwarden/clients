import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { combineLatest, of, shareReplay, Subject, switchMap, takeUntil } from "rxjs";

import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { OrganizationUserService } from "@bitwarden/common/abstractions/organization-user/organization-user.service";
import { OrganizationUserUserDetailsResponse } from "@bitwarden/common/abstractions/organization-user/responses";
import { OrganizationService } from "@bitwarden/common/abstractions/organization/organization.service.abstraction";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { Organization } from "@bitwarden/common/models/domain/organization";
import { CollectionView } from "@bitwarden/common/src/models/view/collection.view";
import { Guid } from "@bitwarden/common/types/guid";
import { BitValidators, DialogService } from "@bitwarden/components";

import {
  CollectionAdminService,
  CollectionAdminView,
  GroupService,
  GroupView,
} from "../../../core";
import {
  AccessItemType,
  AccessItemValue,
  AccessItemView,
  convertToPermission,
  convertToSelectionView,
  PermissionMode,
} from "../access-selector";

export enum CollectionDialogTabType {
  Info = 0,
  Access = 1,
}

export interface CollectionDialogParams {
  collectionId?: Guid;
  organizationId: Guid;
  initialTab?: CollectionDialogTabType;
  parentCollectionId?: Guid;
}

export enum CollectionDialogResult {
  Saved = "saved",
  Canceled = "canceled",
  Deleted = "deleted",
}

@Component({
  selector: "app-collection-dialog",
  templateUrl: "collection-dialog.component.html",
})
export class CollectionDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  protected tabIndex: CollectionDialogTabType;
  protected loading = true;
  protected organization?: Organization;
  protected collection?: CollectionView;
  protected nestOptions: CollectionView[] = [];
  protected accessItems: AccessItemView[] = [];
  protected deletedParentName: string | undefined;
  protected formGroup = this.formBuilder.group({
    name: ["", [Validators.required, BitValidators.forbiddenCharacters(["/"])]],
    externalId: "",
    parent: undefined as string | undefined,
    access: [[] as AccessItemValue[]],
  });
  protected PermissionMode = PermissionMode;

  constructor(
    @Inject(DIALOG_DATA) private params: CollectionDialogParams,
    private formBuilder: FormBuilder,
    private dialogRef: DialogRef<CollectionDialogResult>,
    private organizationService: OrganizationService,
    private groupService: GroupService,
    private collectionService: CollectionAdminService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private organizationUserService: OrganizationUserService
  ) {
    this.tabIndex = params.initialTab ?? CollectionDialogTabType.Info;
  }

  ngOnInit() {
    const organization$ = of(this.organizationService.get(this.params.organizationId)).pipe(
      shareReplay({ refCount: true, bufferSize: 1 })
    );
    const groups$ = organization$.pipe(
      switchMap((organization) => {
        if (!organization.useGroups) {
          return of([] as GroupView[]);
        }

        return this.groupService.getAll(this.params.organizationId);
      })
    );

    combineLatest({
      organization: organization$,
      collections: this.collectionService.getAll(this.params.organizationId),
      collectionDetails: this.params.collectionId
        ? this.collectionService.get(this.params.organizationId, this.params.collectionId)
        : of(null),
      groups: groups$,
      users: this.organizationUserService.getAllUsers(this.params.organizationId),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ organization, collections, collectionDetails, groups, users }) => {
        this.organization = organization;
        this.accessItems = [].concat(
          groups.map(mapGroupToAccessItemView),
          users.data.map(mapUserToAccessItemView)
        );

        if (this.params.collectionId) {
          this.collection = collections.find((c) => c.id === this.collectionId);
          this.nestOptions = collections.filter((c) => c.id !== this.collectionId);

          if (!this.collection) {
            throw new Error("Could not find collection to edit.");
          }

          const { name, parent } = parseName(this.collection);
          if (parent !== undefined && !this.nestOptions.find((c) => c.name === parent)) {
            this.deletedParentName = parent;
          }

          const accessSelections = mapToAccessSelections(collectionDetails);
          this.formGroup.patchValue({
            name,
            externalId: this.collection.externalId,
            parent,
            access: accessSelections,
          });
        } else {
          this.nestOptions = collections;
          const parent = collections.find((c) => c.id === this.params.parentCollectionId);
          this.formGroup.patchValue({ parent: parent?.name ?? undefined });
        }

        this.loading = false;
      });
  }

  protected get collectionId() {
    return this.params.collectionId;
  }

  protected get editMode() {
    return this.params.collectionId != undefined;
  }

  protected async cancel() {
    this.close(CollectionDialogResult.Canceled);
  }

  protected submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      if (this.tabIndex === CollectionDialogTabType.Access) {
        this.platformUtilsService.showToast(
          "error",
          null,
          this.i18nService.t("fieldOnTabRequiresAttention", this.i18nService.t("collectionInfo"))
        );
      }
      return;
    }

    const collectionView = new CollectionAdminView();
    collectionView.id = this.params.collectionId;
    collectionView.organizationId = this.params.organizationId;
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

    await this.collectionService.save(collectionView);

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t(
        this.editMode ? "editedCollectionId" : "createdCollectionId",
        collectionView.name
      )
    );

    this.close(CollectionDialogResult.Saved);
  };

  protected delete = async () => {
    const confirmed = await this.platformUtilsService.showDialog(
      this.i18nService.t("deleteCollectionConfirmation"),
      this.collection?.name,
      this.i18nService.t("yes"),
      this.i18nService.t("no"),
      "warning"
    );

    if (!confirmed && this.params.collectionId) {
      return false;
    }

    await this.collectionService.delete(this.params.organizationId, this.params.collectionId);

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("deletedCollectionId", this.collection?.name)
    );

    this.close(CollectionDialogResult.Deleted);
  };

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private close(result: CollectionDialogResult) {
    this.dialogRef.close(result);
  }
}

function parseName(collection: CollectionView) {
  const nameParts = collection.name?.split("/");
  const name = nameParts[nameParts.length - 1];
  const parent = nameParts.length > 1 ? nameParts.slice(0, -1).join("/") : undefined;

  return { name, parent };
}

function mapGroupToAccessItemView(group: GroupView): AccessItemView {
  return {
    id: group.id,
    type: AccessItemType.Group,
    listName: group.name,
    labelName: group.name,
    accessAllItems: group.accessAll,
    readonly: group.accessAll,
  };
}

// TODO: Use view when user apis are migrated to a service
function mapUserToAccessItemView(user: OrganizationUserUserDetailsResponse): AccessItemView {
  return {
    id: user.id,
    type: AccessItemType.Member,
    email: user.email,
    role: user.type,
    listName: user.name?.length > 0 ? `${user.name} (${user.email})` : user.email,
    labelName: user.name ?? user.email,
    status: user.status,
    accessAllItems: user.accessAll,
    readonly: user.accessAll,
  };
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
    }))
  );
}

/**
 * Strongly typed helper to open a CollectionDialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Configuration for the dialog
 */
export function openCollectionDialog(
  dialogService: DialogService,
  config: DialogConfig<CollectionDialogParams>
) {
  return dialogService.open<CollectionDialogResult, CollectionDialogParams>(
    CollectionDialogComponent,
    config
  );
}
