import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { AbstractControl, FormBuilder, Validators } from "@angular/forms";
import {
  combineLatest,
  from,
  map,
  Observable,
  of,
  shareReplay,
  Subject,
  switchMap,
  takeUntil,
} from "rxjs";
import { first } from "rxjs/operators";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserService } from "@bitwarden/common/admin-console/abstractions/organization-user/organization-user.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { CollectionResponse } from "@bitwarden/common/vault/models/response/collection.response";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { BitValidators, DialogService } from "@bitwarden/components";

import { GroupService, GroupView } from "../../../admin-console/organizations/core";
import { PermissionMode } from "../../../admin-console/organizations/shared/components/access-selector/access-selector.component";
import {
  AccessItemType,
  AccessItemValue,
  AccessItemView,
  CollectionPermission,
  convertToPermission,
  convertToSelectionView,
  mapGroupToAccessItemView,
  mapUserToAccessItemView,
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
  protected flexibleCollectionsV1Enabled$ = this.configService
    .getFeatureFlag$(FeatureFlag.FlexibleCollectionsV1, false)
    .pipe(first());

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
  protected showDeleteButton = false;

  constructor(
    @Inject(DIALOG_DATA) private params: CollectionDialogParams,
    private formBuilder: FormBuilder,
    private dialogRef: DialogRef<CollectionDialogResult>,
    private organizationService: OrganizationService,
    private groupService: GroupService,
    private collectionAdminService: CollectionAdminService,
    private collectionService: CollectionService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private organizationUserService: OrganizationUserService,
    private configService: ConfigService,
    private dialogService: DialogService,
    private changeDetectorRef: ChangeDetectorRef,
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
      await this.loadOrg(this.params.organizationId, this.params.collectionIds);
    }
  }

  async loadOrg(orgId: string, collectionIds: string[]) {
    const organization$ = this.organizationService
      .get$(orgId)
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
      collectionDetails: this.params.collectionId
        ? from(this.collectionAdminService.get(orgId, this.params.collectionId))
        : of(null),
      groups: groups$,
      users: this.organizationUserService.getAllUsers(orgId),
      collection: this.params.collectionId
        ? this.collectionService.get(this.params.collectionId)
        : of(null),
      flexibleCollectionsV1: this.flexibleCollectionsV1Enabled$,
    })
      .pipe(takeUntil(this.formGroup.controls.selectedOrg.valueChanges), takeUntil(this.destroy$))
      .subscribe(
        ({
          organization,
          collections,
          collectionDetails,
          groups,
          users,
          collection,
          flexibleCollectionsV1,
        }) => {
          this.organization = organization;
          this.accessItems = [].concat(
            groups.map(mapGroupToAccessItemView),
            users.data.map(mapUserToAccessItemView),
          );

          // Force change detection to update the access selector's items
          this.changeDetectorRef.detectChanges();

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
            this.collection.manage = collection?.manage ?? false; // Get manage flag from sync data collection
            this.showDeleteButton = this.collection.canDelete(organization);
          } else {
            this.nestOptions = collections;
            const parent = collections.find((c) => c.id === this.params.parentCollectionId);
            const currentOrgUserId = users.data.find(
              (u) => u.userId === this.organization?.userId,
            )?.id;
            const initialSelection: AccessItemValue[] =
              currentOrgUserId !== undefined && organization.flexibleCollections
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

          if (
            organization.flexibleCollections &&
            flexibleCollectionsV1 &&
            !organization.allowAdminAccessToAllCollectionItems
          ) {
            this.formGroup.controls.access.addValidators(validateCanManagePermission);
          } else {
            this.formGroup.controls.access.removeValidators(validateCanManagePermission);
          }
          this.formGroup.controls.access.updateValueAndValidity();

          this.loading = false;
        },
      );
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
      const accessTabError = this.formGroup.controls.access.hasError("managePermissionRequired");

      if (this.tabIndex === CollectionDialogTabType.Access && !accessTabError) {
        this.platformUtilsService.showToast(
          "error",
          null,
          this.i18nService.t("fieldOnTabRequiresAttention", this.i18nService.t("collectionInfo")),
        );
      } else if (this.tabIndex === CollectionDialogTabType.Info && accessTabError) {
        this.platformUtilsService.showToast(
          "error",
          null,
          this.i18nService.t("fieldOnTabRequiresAttention", this.i18nService.t("access")),
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

    const savedCollection = await this.collectionAdminService.save(collectionView);

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t(
        this.editMode ? "editedCollectionId" : "createdCollectionId",
        collectionView.name,
      ),
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

    await this.collectionAdminService.delete(this.params.organizationId, this.params.collectionId);

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("deletedCollectionId", this.collection?.name),
    );

    this.close(CollectionDialogAction.Deleted, this.collection);
  };

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
