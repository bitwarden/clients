import { AsyncPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import {
  combineLatest,
  firstValueFrom,
  from,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from "rxjs";

import {
  CollectionAdminService,
  OrganizationUserUpdateRequest,
} from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import {
  CollectionAccessSelectionView,
  CollectionAdminView,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { getById } from "@bitwarden/common/platform/misc";
import {
  A11yTitleDirective,
  AsyncActionsModule,
  BadgeModule,
  ButtonModule,
  CheckboxModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  RadioButtonModule,
  SelectModule,
  TabsModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { BillingConstraintService } from "@bitwarden/web-vault/app/billing/members/billing-constraint/billing-constraint.service";

import {
  GroupApiService,
  GroupDetailsView,
  OrganizationUserAdminView,
  UserAdminService,
} from "../../../core";
import {
  AccessItemType,
  AccessItemValue,
  AccessItemView,
  AccessSelectorModule,
  convertToPermission,
  convertToSelectionView,
  PermissionMode,
} from "../../../shared/components/access-selector";
import { DeleteManagedMemberWarningService } from "../../services/delete-managed-member/delete-managed-member-warning.service";
import { MemberActionsService } from "../../services/member-actions/member-actions.service";
import {
  EditMemberDialogParams,
  MemberDialogResult,
  MemberDialogTab,
} from "../member-dialog/member-dialog.types";
import { NestedCheckboxComponent } from "../member-dialog/nested-checkbox.component";

@Component({
  standalone: true,
  selector: "app-edit-member-dialog",
  templateUrl: "edit-member-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    A11yTitleDirective,
    AsyncActionsModule,
    AsyncPipe,
    BadgeModule,
    ButtonModule,
    CheckboxModule,
    DialogModule,
    FormFieldModule,
    I18nPipe,
    RadioButtonModule,
    ReactiveFormsModule,
    SelectModule,
    TabsModule,
    AccessSelectorModule,
    NestedCheckboxComponent,
  ],
})
export class EditMemberDialogComponent {
  protected readonly params = inject<EditMemberDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<MemberDialogResult>>(DialogRef);
  private readonly i18nService = inject(I18nService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly collectionAdminService = inject(CollectionAdminService);
  private readonly groupService = inject(GroupApiService);
  private readonly userService = inject(UserAdminService);
  private readonly memberActionsService = inject(MemberActionsService);
  private readonly dialogService = inject(DialogService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly toastService = inject(ToastService);
  private readonly deleteManagedMemberWarningService = inject(DeleteManagedMemberWarningService);
  private readonly billingConstraint = inject(BillingConstraintService);
  private readonly organizationMetadataService = inject(OrganizationMetadataServiceAbstraction);

  protected readonly organizationUserType = OrganizationUserType;
  protected readonly PermissionMode = PermissionMode;
  protected readonly ProductTierType = ProductTierType;

  readonly loading = signal(true);
  readonly isRevoked = signal(false);
  readonly showNoMasterPasswordWarning = signal(false);
  protected readonly tabIndex = signal<number>(this.params.initialTab);

  protected readonly collectionAccessItems = signal<AccessItemView[]>([]);
  protected readonly groupAccessItems = signal<AccessItemView[]>([]);

  protected readonly formGroup = this.formBuilder.group({
    type: this.formBuilder.nonNullable.control(OrganizationUserType.User),
    // set to readonly in the template
    externalId: this.formBuilder.control({ value: "", disabled: false }),
    // set to readonly in the template
    ssoExternalId: this.formBuilder.control({ value: "", disabled: false }),
    accessSecretsManager: false,
    access: [[] as AccessItemValue[]],
    groups: [[] as AccessItemValue[]],
  });

  protected readonly permissionsGroup = this.formBuilder.group({
    manageAllCollectionsGroup: this.formBuilder.group<Record<string, boolean>>({
      manageAllCollections: false,
      createNewCollections: false,
      editAnyCollection: false,
      deleteAnyCollection: false,
    }),
    accessEventLogs: false,
    accessImportExport: false,
    accessReports: false,
    manageGroups: false,
    manageSso: false,
    managePolicies: false,
    manageUsers: false,
    manageResetPassword: false,
  });

  private readonly formTypeValue = toSignal(this.formGroup.controls.type.valueChanges, {
    initialValue: this.formGroup.controls.type.value,
  });

  protected readonly externalId = toSignal(
    this.formGroup.controls.externalId.valueChanges.pipe(map((v) => v || undefined)),
    { initialValue: this.formGroup.controls.externalId.value || undefined },
  );

  protected readonly ssoExternalId = toSignal(
    this.formGroup.controls.ssoExternalId.valueChanges.pipe(map((v) => v || undefined)),
    { initialValue: this.formGroup.controls.ssoExternalId.value || undefined },
  );

  protected readonly customUserTypeSelected = computed(
    () => this.formTypeValue() === OrganizationUserType.Custom,
  );

  protected readonly organization$: Observable<Organization> =
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.organizationService.organizations$(userId)),
      getById(this.params.organizationId),
      map((organization) => {
        if (organization == undefined) {
          throw new Error("Organization not found");
        }
        return organization;
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

  private readonly userDetails$: Observable<OrganizationUserAdminView | undefined> = from(
    this.userService.get(this.params.organizationId, this.params.organizationUserId),
  );

  private readonly allowAdminAccessToAllCollectionItems$: Observable<boolean> =
    this.organization$.pipe(
      map((organization) => organization.allowAdminAccessToAllCollectionItems),
    );

  protected readonly restrictEditingSelf$: Observable<boolean> = combineLatest([
    this.allowAdminAccessToAllCollectionItems$,
    this.userDetails$,
    this.accountService.activeAccount$.pipe(getUserId),
  ]).pipe(
    map(
      ([allowAdminAccess, userDetails, userId]) =>
        !allowAdminAccess && userDetails != undefined && userDetails.userId == userId,
    ),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  protected readonly canAssignAccessToAnyCollection$: Observable<boolean> = combineLatest([
    this.organization$,
    this.allowAdminAccessToAllCollectionItems$,
  ]).pipe(
    map(
      ([org, allowAdminAccessToAllCollectionItems]) =>
        org.canEditAnyCollection ||
        (org.permissions.manageUsers && allowAdminAccessToAllCollectionItems),
    ),
  );

  constructor() {
    const groups$ = this.organization$.pipe(
      switchMap((organization) =>
        organization.useGroups
          ? this.groupService.getAllDetails(this.params.organizationId)
          : of([] as GroupDetailsView[]),
      ),
    );

    this.restrictEditingSelf$.pipe(takeUntilDestroyed()).subscribe((restrictEditingSelf) => {
      if (restrictEditingSelf) {
        this.formGroup.controls.groups.disable();
      } else {
        this.formGroup.controls.groups.enable();
      }
    });

    const collections$ = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.collectionAdminService.collectionAdminViews$(this.params.organizationId, userId),
      ),
    );

    let formInitialized = false;

    combineLatest({
      organization: this.organization$,
      collections: collections$,
      userDetails: this.userDetails$,
      groups: groups$,
    })
      .pipe(takeUntilDestroyed())
      .subscribe(({ organization, collections, userDetails, groups }) => {
        this.groupAccessItems.set(groups.map<AccessItemView>((g) => mapGroupToAccessItemView(g)));

        const collectionItems = collections
          .map((c) =>
            mapCollectionToAccessItemView(
              c,
              organization,
              userDetails == undefined
                ? undefined
                : c.users.find((access) => access.id === userDetails.id),
            ),
          )
          .filter(
            (item) =>
              !item.readonly || userDetails?.collections.some((access) => access.id == item.id),
          );

        this.collectionAccessItems.set(collectionItems);

        if (userDetails == undefined) {
          this.toastService.showToast({
            variant: "error",
            title: this.i18nService.t("errorOccurred"),
            message: this.i18nService.t("orgUserDetailsNotFound"),
          });
          this.close(MemberDialogResult.Canceled);
          return;
        }

        // Only patch the form on first load — subsequent emissions update the item list
        // (collectionAccessItems) but must not overwrite user-made permission changes.
        if (!formInitialized) {
          formInitialized = true;
          this.loadOrganizationUser(userDetails, groups, collections, organization);
          this.loading.set(false);
        }
      });
  }

  private loadOrganizationUser(
    userDetails: OrganizationUserAdminView,
    groups: GroupDetailsView[],
    collections: CollectionAdminView[],
    organization: Organization,
  ) {
    this.isRevoked.set(userDetails.status === OrganizationUserStatusType.Revoked);
    this.showNoMasterPasswordWarning.set(
      userDetails.status > OrganizationUserStatusType.Invited &&
        userDetails.hasMasterPassword === false,
    );
    const allCollectionsPermissions = {
      createNewCollections: userDetails.permissions.createNewCollections,
      editAnyCollection: userDetails.permissions.editAnyCollection,
      deleteAnyCollection: userDetails.permissions.deleteAnyCollection,
      manageAllCollections:
        userDetails.permissions.createNewCollections &&
        userDetails.permissions.editAnyCollection &&
        userDetails.permissions.deleteAnyCollection,
    };
    if (userDetails.type === OrganizationUserType.Custom) {
      this.permissionsGroup.patchValue({
        accessEventLogs: userDetails.permissions.accessEventLogs,
        accessImportExport: userDetails.permissions.accessImportExport,
        accessReports: userDetails.permissions.accessReports,
        manageGroups: userDetails.permissions.manageGroups,
        manageSso: userDetails.permissions.manageSso,
        managePolicies: userDetails.permissions.managePolicies,
        manageUsers: userDetails.permissions.manageUsers,
        manageResetPassword: userDetails.permissions.manageResetPassword,
        manageAllCollectionsGroup: allCollectionsPermissions,
      });
    }

    const collectionsFromGroups = groups
      .filter((group) => userDetails.groups.includes(group.id))
      .flatMap((group) =>
        group.collections.map((accessSelection) => {
          const collection = collections.find((c) => c.id === accessSelection.id);
          if (collection == null) {
            throw new Error("No collection found from group.");
          }
          return { group, collection, accessSelection };
        }),
      );

    this.collectionAccessItems.set(
      this.collectionAccessItems().concat(
        collectionsFromGroups.map(({ collection, accessSelection, group }) =>
          mapCollectionToAccessItemView(collection, organization, accessSelection, group),
        ),
      ),
    );

    const accessSelections = mapToAccessSelections(userDetails, this.collectionAccessItems());
    const groupAccessSelections = mapToGroupAccessSelections(userDetails.groups);

    this.formGroup.patchValue({
      type: userDetails.type,
      externalId: userDetails.externalId,
      ssoExternalId: userDetails.ssoExternalId,
      access: accessSelections,
      accessSecretsManager: userDetails.accessSecretsManager,
      groups: groupAccessSelections,
    });
  }

  private setRequestPermissions(p: PermissionsApi, clearPermissions: boolean): PermissionsApi {
    if (clearPermissions) {
      return new PermissionsApi();
    }
    const partialPermissions: Partial<PermissionsApi> = {
      accessEventLogs: this.permissionsGroup.value.accessEventLogs ?? undefined,
      accessImportExport: this.permissionsGroup.value.accessImportExport ?? undefined,
      accessReports: this.permissionsGroup.value.accessReports ?? undefined,
      manageGroups: this.permissionsGroup.value.manageGroups ?? undefined,
      manageSso: this.permissionsGroup.value.manageSso ?? undefined,
      managePolicies: this.permissionsGroup.value.managePolicies ?? undefined,
      manageUsers: this.permissionsGroup.value.manageUsers ?? undefined,
      manageResetPassword: this.permissionsGroup.value.manageResetPassword ?? undefined,
      createNewCollections:
        this.permissionsGroup.value.manageAllCollectionsGroup?.createNewCollections ?? undefined,
      editAnyCollection:
        this.permissionsGroup.value.manageAllCollectionsGroup?.editAnyCollection ?? undefined,
      deleteAnyCollection:
        this.permissionsGroup.value.manageAllCollectionsGroup?.deleteAnyCollection ?? undefined,
    };

    return Object.assign(p, partialPermissions);
  }

  private async handleEditUser(organization: Organization) {
    const userId = this.params.organizationUserId;
    const type = this.formGroup.getRawValue().type;
    const permissions = this.setRequestPermissions(
      new PermissionsApi(),
      type !== OrganizationUserType.Custom,
    );

    const collections = this.formGroup.value.access
      ?.filter((v) => v.type === AccessItemType.Collection)
      .map(convertToSelectionView);

    const groups = (await firstValueFrom(this.restrictEditingSelf$))
      ? undefined
      : this.formGroup.value.groups?.map((m) => m.id);

    const accessSecretsManager = this.formGroup.value.accessSecretsManager ?? undefined;

    const request = new OrganizationUserUpdateRequest({
      type,
      permissions,
      groups,
      collections,
      accessSecretsManager,
    });

    await this.userService.saveV2(request, userId, organization);

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("editedUserId", this.params.name),
    });

    this.close(MemberDialogResult.Saved);
  }

  readonly submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      if (this.tabIndex() !== MemberDialogTab.Role) {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("fieldOnTabRequiresAttention", this.i18nService.t("role")),
        });
      }
      return;
    }

    const organization = await firstValueFrom(this.organization$);

    if (!organization.useCustomPermissions && this.customUserTypeSelected()) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("customNonEnterpriseError"),
      });
      return;
    }

    await this.handleEditUser(organization);
  };

  readonly revoke = async () => {
    let confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "revokeUserId", placeholders: [this.params.name] },
      content: { key: "revokeUserConfirmation" },
      acceptButtonText: { key: "revokeAccess" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    if (this.showNoMasterPasswordWarning()) {
      confirmed = await this.noMasterPasswordConfirmationDialog(this.params.name);

      if (!confirmed) {
        return false;
      }
    }

    const organization = await firstValueFrom(this.organization$);
    const result = await this.memberActionsService.revokeUser(
      organization,
      this.params.organizationUserId,
    );
    if (result.success === false) {
      throw new Error(result.error);
    }

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("revokedUserId", this.params.name),
    });
    this.isRevoked.set(true);
    this.close(MemberDialogResult.Revoked);
  };

  readonly restore = async () => {
    const organization = await firstValueFrom(this.organization$);

    const billingMetadata = await firstValueFrom(
      this.organizationMetadataService.getOrganizationMetadata$(organization.id),
    );
    const seatLimitResult = this.billingConstraint.checkSeatLimit(organization, billingMetadata);
    if (await this.billingConstraint.seatLimitReached(seatLimitResult, organization, "restore")) {
      return;
    }

    const result = await this.memberActionsService.restoreUser(
      organization,
      this.params.organizationUserId,
    );
    if (result.success === false) {
      throw new Error(result.error);
    }

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("restoredUserId", this.params.name),
    });
    this.isRevoked.set(false);
    this.close(MemberDialogResult.Restored);
  };

  readonly remove = async () => {
    const message = this.params.usesKeyConnector
      ? "removeUserConfirmationKeyConnector"
      : "removeOrgUserConfirmation";

    let confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "removeUserIdAccess", placeholders: [this.params.name] },
      content: { key: message },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    if (this.showNoMasterPasswordWarning()) {
      confirmed = await this.noMasterPasswordConfirmationDialog(this.params.name);

      if (!confirmed) {
        return false;
      }
    }

    const organization = await firstValueFrom(this.organization$);
    const result = await this.memberActionsService.removeUser(
      organization,
      this.params.organizationUserId,
    );
    if (result.success === false) {
      throw new Error(result.error);
    }

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("removedUserId", this.params.name),
    });
    this.close(MemberDialogResult.Deleted);
  };

  readonly delete = async () => {
    const showWarningDialog = combineLatest([
      this.organization$,
      this.deleteManagedMemberWarningService.warningAcknowledged(this.params.organizationId),
    ]).pipe(
      map(
        ([organization, acknowledged]) =>
          organization.canManageUsers &&
          organization.productTierType === ProductTierType.Enterprise &&
          !acknowledged,
      ),
    );

    if (await firstValueFrom(showWarningDialog)) {
      const acknowledged = await this.deleteManagedMemberWarningService.showWarning();
      if (!acknowledged) {
        return;
      }
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: {
        key: "deleteOrganizationUser",
        placeholders: [this.params.name],
      },
      content: {
        key: "deleteOrganizationUserWarningDesc",
        placeholders: [this.params.name],
      },
      type: "warning",
      acceptButtonText: { key: "delete" },
      cancelButtonText: { key: "cancel" },
    });

    if (!confirmed) {
      return false;
    }

    const organization = await firstValueFrom(this.organization$);
    const result = await this.memberActionsService.deleteUser(
      organization,
      this.params.organizationUserId,
    );
    if (result.success === false) {
      throw new Error(result.error);
    }

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("organizationUserDeleted", this.params.name),
    });

    await this.deleteManagedMemberWarningService.acknowledgeWarning(this.params.organizationId);

    this.close(MemberDialogResult.Deleted);
  };

  protected cancel() {
    this.close(MemberDialogResult.Canceled);
  }

  private close(result: MemberDialogResult) {
    void this.dialogRef.close(result);
  }

  private noMasterPasswordConfirmationDialog(username: string) {
    return this.dialogService.openSimpleDialog({
      title: {
        key: "removeOrgUserNoMasterPasswordTitle",
      },
      content: {
        key: "removeOrgUserNoMasterPasswordDesc",
        placeholders: [username],
      },
      type: "warning",
    });
  }

  static readonly open = (
    dialogService: DialogService,
    config: DialogConfig<EditMemberDialogParams>,
  ) =>
    dialogService.open<MemberDialogResult, EditMemberDialogParams>(
      EditMemberDialogComponent,
      config,
    );
}

function mapCollectionToAccessItemView(
  collection: CollectionAdminView,
  organization: Organization,
  accessSelection?: CollectionAccessSelectionView,
  group?: GroupDetailsView,
): AccessItemView {
  return {
    type: AccessItemType.Collection,
    id: group ? `${collection.id}-${group.id}` : collection.id,
    labelName: collection.name,
    listName: collection.name,
    readonly: group !== undefined || !collection.canEditUserAccess(organization),
    readonlyPermission: accessSelection ? convertToPermission(accessSelection) : undefined,
    viaGroupName: group?.name,
  };
}

function mapGroupToAccessItemView(group: GroupDetailsView): AccessItemView {
  return {
    type: AccessItemType.Group,
    id: group.id,
    labelName: group.name,
    listName: group.name,
  };
}

function mapToAccessSelections(
  user: OrganizationUserAdminView,
  items: AccessItemView[],
): AccessItemValue[] {
  return user.collections
    .filter((selection) => !items.find((item) => item.id == selection.id)?.readonly)
    .map<AccessItemValue>((selection) => ({
      id: selection.id,
      type: AccessItemType.Collection,
      permission: convertToPermission(selection),
    }));
}

function mapToGroupAccessSelections(groups: string[]): AccessItemValue[] {
  return groups.map((groupId) => ({ id: groupId, type: AccessItemType.Group }));
}
