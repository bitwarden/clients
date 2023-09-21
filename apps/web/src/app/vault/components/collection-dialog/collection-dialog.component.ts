import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import {
  combineLatest,
  map,
  Observable,
  of,
  shareReplay,
  Subject,
  switchMap,
  takeUntil,
} from "rxjs";

import { OrganizationUserService } from "@bitwarden/common/abstractions/organization-user/organization-user.service";
import { OrganizationUserUserDetailsResponse } from "@bitwarden/common/abstractions/organization-user/responses";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CollectionResponse } from "@bitwarden/common/vault/models/response/collection.response";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { DialogService, BitValidators } from "@bitwarden/components";

import { GroupService, GroupView } from "../../../admin-console/organizations/core";
import { PermissionMode } from "../../../admin-console/organizations/shared/components/access-selector/access-selector.component";
import {
  AccessItemView,
  AccessItemValue,
  AccessItemType,
  convertToSelectionView,
  convertToPermission,
} from "../../../admin-console/organizations/shared/components/access-selector/access-selector.models";
import { CollectionAdminService } from "../../core/collection-admin.service";
import { CollectionAdminView } from "../../core/views/collection-admin.view";

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
  collectionIds?: string[];
}

export interface CollectionDialogResult {
  action: CollectionDialogAction;
  collection: CollectionResponse;
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
  protected collection?: CollectionView;
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

  constructor(
    @Inject(DIALOG_DATA) private params: CollectionDialogParams,
    private formBuilder: FormBuilder,
    private dialogRef: DialogRef<CollectionDialogResult>,
    private organizationService: OrganizationService,
    private groupService: GroupService,
    private collectionService: CollectionAdminService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private organizationUserService: OrganizationUserService,
    private dialogService: DialogService
  ) {
    this.tabIndex = params.initialTab ?? CollectionDialogTabType.Info;
  }

  async ngOnInit() {
    // Opened from the individual vault
    if (this.params.showOrgSelector) {
      this.showOrgSelector = true;
      this.formGroup.controls.selectedOrg.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((id) => this.loadOrg(id, this.params.collectionIds));
      this.organizations$ = this.organizationService.organizations$.pipe(
        map((orgs) =>
          orgs
            .filter((o) => o.canCreateNewCollections && !o.isProviderUser)
            .sort(Utils.getSortFunction(this.i18nService, "name"))
        )
      );
      // patchValue will trigger a call to loadOrg() in this case, so no need to call it again here
      this.formGroup.patchValue({ selectedOrg: this.params.organizationId });
    } else {
      // Opened from the org vault
      this.formGroup.patchValue({ selectedOrg: this.params.organizationId });
      this.loadOrg(this.params.organizationId, this.params.collectionIds);
    }
  }

  async loadOrg(orgId: string, collectionIds: string[]) {
    const organization$ = of(this.organizationService.get(orgId)).pipe(
      shareReplay({ refCount: true, bufferSize: 1 })
    );
    const groups$ = organization$.pipe(
      switchMap((organization) => {
        if (!organization.useGroups) {
          return of([] as GroupView[]);
        }

        return this.groupService.getAll(orgId);
      })
    );
    combineLatest({
      organization: organization$,
      collections: this.collectionService.getAll(orgId),
      collectionDetails: this.params.collectionId
        ? this.collectionService.get(orgId, this.params.collectionId)
        : of(null),
      groups: groups$,
      users: this.organizationUserService.getAllUsers(orgId),
    })
      .pipe(takeUntil(this.formGroup.controls.selectedOrg.valueChanges), takeUntil(this.destroy$))
      .subscribe(({ organization, collections, collectionDetails, groups, users }) => {
        this.organization = organization;
        this.accessItems = [].concat(
          groups.map(mapGroupToAccessItemView),
          users.data.map(mapUserToAccessItemView)
        );

        if (collectionIds) {
          collections = collections.filter((c) => collectionIds.includes(c.id));
        }

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
    this.close(CollectionDialogAction.Canceled);
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

    const savedCollection = await this.collectionService.save(collectionView);

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t(
        this.editMode ? "editedCollectionId" : "createdCollectionId",
        collectionView.name
      )
    );

    this.close(CollectionDialogAction.Saved, savedCollection);
  };

  protected delete = async () => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: this.collection?.name,
      content: { key: "deleteCollectionConfirmation" },
      type: "warning",
    });

    if (!confirmed && this.params.collectionId) {
      return false;
    }

    await this.collectionService.delete(this.params.organizationId, this.params.collectionId);

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("deletedCollectionId", this.collection?.name)
    );

    this.close(CollectionDialogAction.Deleted);
  };

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private close(action: CollectionDialogAction, collection?: CollectionResponse) {
    this.dialogRef.close({ action, collection } as CollectionDialogResult);
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
