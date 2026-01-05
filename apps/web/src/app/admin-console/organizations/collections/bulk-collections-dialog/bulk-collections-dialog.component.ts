// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject, OnDestroy } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { combineLatest, of, Subject, switchMap, takeUntil } from "rxjs";

import {
  CollectionAdminService,
  OrganizationUserApiService,
  CollectionView,
} from "@bitwarden/admin-console/common";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";

import { SharedModule } from "../../../../shared";
import { GroupApiService, GroupView } from "../../core";
import {
  AccessItemType,
  AccessItemValue,
  AccessItemView,
  AccessSelectorModule,
  convertToSelectionView,
  mapGroupToAccessItemView,
  mapUserToAccessItemView,
  PermissionMode,
} from "../../shared/components/access-selector";

export interface BulkCollectionsDialogParams {
  organizationId: string;
  collections: CollectionView[];
}

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum BulkCollectionsDialogResult {
  Saved = "saved",
  Canceled = "canceled",
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  imports: [SharedModule, AccessSelectorModule],
  selector: "app-bulk-collections-dialog",
  templateUrl: "bulk-collections-dialog.component.html",
})
export class BulkCollectionsDialogComponent implements OnDestroy {
  protected readonly PermissionMode = PermissionMode;

  protected formGroup = this.formBuilder.group({
    access: [[] as AccessItemValue[]],
  });
  protected loading = true;
  protected organization: Organization;
  protected accessItems: AccessItemView[] = [];
  protected numCollections: number;

  private destroy$ = new Subject<void>();

  constructor(
    @Inject(DIALOG_DATA) private params: BulkCollectionsDialogParams,
    private dialogRef: DialogRef<BulkCollectionsDialogResult>,
    private formBuilder: FormBuilder,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private groupService: GroupApiService,
    private organizationUserApiService: OrganizationUserApiService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private collectionAdminService: CollectionAdminService,
    private toastService: ToastService,
  ) {
    this.numCollections = this.params.collections.length;
    const organization$ = this.accountService.activeAccount$.pipe(
      switchMap((account) =>
        this.organizationService
          .organizations$(account?.id)
          .pipe(getOrganizationById(this.params.organizationId)),
      ),
    );
    const groups$ = organization$.pipe(
      switchMap((organization) => {
        if (!organization.useGroups) {
          return of([] as GroupView[]);
        }
        return this.groupService.getAll(organization.id);
      }),
    );

    combineLatest([
      organization$,
      groups$,
      this.organizationUserApiService.getAllMiniUserDetails(this.params.organizationId),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([organization, groups, users]) => {
        this.organization = organization;

        this.accessItems = [].concat(
          groups.map(mapGroupToAccessItemView),
          users.data.map(mapUserToAccessItemView),
        );

        this.loading = false;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit = async () => {
    const users = this.formGroup.controls.access.value
      .filter((v) => v.type === AccessItemType.Member)
      .map(convertToSelectionView);

    const groups = this.formGroup.controls.access.value
      .filter((v) => v.type === AccessItemType.Group)
      .map(convertToSelectionView);

    await this.collectionAdminService.bulkAssignAccess(
      this.organization.id,
      this.params.collections.map((c) => c.id),
      users,
      groups,
    );

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("editedCollections"),
    });

    this.dialogRef.close(BulkCollectionsDialogResult.Saved);
  };

  static open(dialogService: DialogService, config: DialogConfig<BulkCollectionsDialogParams>) {
    return dialogService.open<BulkCollectionsDialogResult, BulkCollectionsDialogParams>(
      BulkCollectionsDialogComponent,
      config,
    );
  }
}
