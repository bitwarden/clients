import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { combineLatest, of, shareReplay, Subject, switchMap, takeUntil } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { GroupServiceAbstraction } from "../../../services/abstractions/group";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { OrganizationService } from "@bitwarden/common/abstractions/organization/organization.service.abstraction";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { Organization } from "@bitwarden/common/models/domain/organization";
import { CollectionView } from "@bitwarden/common/src/models/view/collection.view";
import { BitValidators, DialogService } from "@bitwarden/components";

import { CollectionAdminView, CollectionAdminService } from "../../../core";
import {
  AccessItemType,
  AccessItemValue,
  AccessItemView,
  convertToPermission,
  convertToSelectionView,
} from "../access-selector";

export interface CollectionDialogParams {
  collectionId?: string;
  organizationId: string;
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

  protected loading = true;
  protected organization?: Organization;
  protected collection?: CollectionView;
  protected nestOptions: CollectionView[] = [];
  protected accessItems: AccessItemView[] = [];
  protected removedParentName: string | undefined;
  protected formGroup = this.formBuilder.group({
    name: ["", BitValidators.forbiddenCharacters(["/"])],
    externalId: "",
    parent: null as string | null,
    access: [[] as AccessItemValue[]],
  });

  constructor(
    @Inject(DIALOG_DATA) private params: CollectionDialogParams,
    private formBuilder: FormBuilder,
    private dialogRef: DialogRef<CollectionDialogResult>,
    private apiService: ApiService,
    private organizationService: OrganizationService,
    private groupService: GroupServiceAbstraction,
    private collectionService: CollectionAdminService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService
  ) {}

  ngOnInit() {
    const organization$ = of(this.organizationService.get(this.params.organizationId)).pipe(
      shareReplay({ refCount: true, bufferSize: 1 })
    );
    const groups$ = organization$.pipe(
      switchMap((organization) => {
        if (!organization.useGroups) {
          return of([]);
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
      users: this.apiService.getOrganizationUsers(this.params.organizationId),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ organization, collections, collectionDetails, groups, users }) => {
        this.organization = organization;
        this.accessItems = [].concat(
          groups.map((group) => ({
            id: group.id,
            type: AccessItemType.Group,
            listName: group.name,
            labelName: group.name,
            accessAllItems: group.accessAll,
            readonly: group.accessAll,
          })),
          users.data.map((user) => ({
            id: user.id,
            type: AccessItemType.Member,
            email: user.email,
            role: user.type,
            listName: user.name?.length > 0 ? `${user.name} (${user.email})` : user.email,
            labelName: user.name ?? user.email,
            status: user.status,
            accessAllItems: user.accessAll,
            readonly: user.accessAll,
          }))
        );

        if (this.params.collectionId) {
          this.collection = collections.find((c) => c.id === this.collectionId);
          this.nestOptions = collections.filter((c) => c.id !== this.collectionId);

          if (!this.collection) {
            throw new Error("Could not find collection to edit.");
          }

          const nameParts = this.collection.name?.split("/");
          const name = nameParts[nameParts.length - 1];
          const parent = nameParts.length > 1 ? nameParts.slice(0, -1).join("/") : null;

          if (parent !== null && !this.nestOptions.find((c) => c.name === parent)) {
            this.removedParentName = parent;
          }

          let accessSelections: AccessItemValue[] = [];
          if (collectionDetails) {
            accessSelections = [].concat(
              collectionDetails.groups.map<AccessItemValue>((selection) => ({
                id: selection.id,
                type: AccessItemType.Group,
                permission: convertToPermission(selection),
              })),
              collectionDetails.users.map((selection) => ({
                id: selection.id,
                type: AccessItemType.Member,
                permission: convertToPermission(selection),
              }))
            );
          }

          this.formGroup.patchValue({
            name,
            externalId: this.collection.externalId,
            parent,
            access: accessSelections,
          });
        } else {
          this.nestOptions = collections;
        }

        this.loading = false;
      });
  }

  protected get collectionId() {
    return this.params.collectionId;
  }

  protected async cancel() {
    this.close(CollectionDialogResult.Canceled);
  }

  protected submit = async () => {
    if (this.formGroup.invalid) {
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

    this.close(CollectionDialogResult.Saved);
  };

  protected remove = async () => {
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

    await this.collectionService.remove(this.params.organizationId, this.params.collectionId);

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
