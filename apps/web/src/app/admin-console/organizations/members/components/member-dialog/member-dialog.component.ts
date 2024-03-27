import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject, OnDestroy } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
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

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserService } from "@bitwarden/common/admin-console/abstractions/organization-user/organization-user.service";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { DialogService } from "@bitwarden/components";

import { CollectionAdminService } from "../../../../../vault/core/collection-admin.service";
import {
  CollectionAccessSelectionView,
  GroupService,
  GroupView,
  OrganizationUserAdminView,
  UserAdminService,
} from "../../../core";
import {
  AccessItemType,
  AccessItemValue,
  AccessItemView,
  convertToPermission,
  convertToSelectionView,
  PermissionMode,
} from "../../../shared/components/access-selector";

import { commaSeparatedEmails } from "./validators/comma-separated-emails.validator";
import { orgSeatLimitReachedValidator } from "./validators/org-seat-limit-reached.validator";

export enum MemberDialogTab {
  Role = 0,
  Groups = 1,
  Collections = 2,
}

export interface MemberDialogParams {
  name: string;
  organizationId: string;
  organizationUserId: string;
  allOrganizationUserEmails: string[];
  usesKeyConnector: boolean;
  initialTab?: MemberDialogTab;
  numConfirmedMembers: number;
}

export enum MemberDialogResult {
  Saved = "saved",
  Canceled = "canceled",
  Deleted = "deleted",
  Revoked = "revoked",
  Restored = "restored",
}

@Component({
  templateUrl: "member-dialog.component.html",
})
export class MemberDialogComponent implements OnDestroy {
  loading = true;
  editMode = false;
  isRevoked = false;
  title: string;
  access: "all" | "selected" = "selected";
  collections: CollectionView[] = [];
  organizationUserType = OrganizationUserType;
  PermissionMode = PermissionMode;
  showNoMasterPasswordWarning = false;

  protected organization$: Observable<Organization>;
  protected collectionAccessItems: AccessItemView[] = [];
  protected groupAccessItems: AccessItemView[] = [];
  protected tabIndex: MemberDialogTab;
  protected formGroup = this.formBuilder.group({
    emails: [""],
    type: OrganizationUserType.User,
    externalId: this.formBuilder.control({ value: "", disabled: true }),
    accessAllCollections: false,
    accessSecretsManager: false,
    access: [[] as AccessItemValue[]],
    groups: [[] as AccessItemValue[]],
  });

  protected restrictedAccess$: Observable<boolean>;

  protected permissionsGroup = this.formBuilder.group({
    manageAssignedCollectionsGroup: this.formBuilder.group<Record<string, boolean>>({
      manageAssignedCollections: false,
      editAssignedCollections: false,
      deleteAssignedCollections: false,
    }),
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

  private destroy$ = new Subject<void>();

  get customUserTypeSelected(): boolean {
    return this.formGroup.value.type === OrganizationUserType.Custom;
  }

  get accessAllCollections(): boolean {
    return this.formGroup.value.accessAllCollections;
  }

  constructor(
    @Inject(DIALOG_DATA) protected params: MemberDialogParams,
    private dialogRef: DialogRef<MemberDialogResult>,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private formBuilder: FormBuilder,
    // TODO: We should really look into consolidating naming conventions for these services
    private collectionAdminService: CollectionAdminService,
    private groupService: GroupService,
    private userService: UserAdminService,
    private organizationUserService: OrganizationUserService,
    private dialogService: DialogService,
    private configService: ConfigService,
    private accountService: AccountService,
    organizationService: OrganizationService,
  ) {
    this.organization$ = organizationService
      .get$(this.params.organizationId)
      .pipe(shareReplay({ refCount: true, bufferSize: 1 }));

    this.editMode = this.params.organizationUserId != null;
    this.tabIndex = this.params.initialTab ?? MemberDialogTab.Role;
    this.title = this.i18nService.t(this.editMode ? "editMember" : "inviteMember");

    const groups$ = this.organization$.pipe(
      switchMap((organization) =>
        organization.useGroups
          ? this.groupService.getAll(this.params.organizationId)
          : of([] as GroupView[]),
      ),
    );

    const userDetails$ = this.params.organizationUserId
      ? this.userService.get(this.params.organizationId, this.params.organizationUserId)
      : of(null);

    // The orgUser cannot manage their own Group assignments if collection access is restricted
    // TODO: fix disabled state of access-selector rows so that any controls are hidden
    this.restrictedAccess$ = combineLatest([
      this.organization$,
      userDetails$,
      this.accountService.activeAccount$,
      this.configService.getFeatureFlag$(FeatureFlag.FlexibleCollectionsV1),
    ]).pipe(
      map(
        ([organization, userDetails, activeAccount, flexibleCollectionsV1Enabled]) =>
          // Feature flag conditionals
          flexibleCollectionsV1Enabled &&
          organization.flexibleCollections &&
          // Business logic conditionals
          userDetails != null &&
          userDetails.userId == activeAccount.id &&
          !organization.allowAdminAccessToAllCollectionItems,
      ),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.restrictedAccess$.pipe(takeUntil(this.destroy$)).subscribe((restrictedAccess) => {
      if (restrictedAccess) {
        this.formGroup.controls.groups.disable();
      } else {
        this.formGroup.controls.groups.enable();
      }
    });

    combineLatest({
      organization: this.organization$,
      collections: this.collectionAdminService.getAll(this.params.organizationId),
      userDetails: userDetails$,
      groups: groups$,
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ organization, collections, userDetails, groups }) => {
        this.setFormValidators(organization);

        this.collectionAccessItems = [].concat(
          collections.map((c) => mapCollectionToAccessItemView(c)),
        );

        this.groupAccessItems = [].concat(
          groups.map<AccessItemView>((g) => mapGroupToAccessItemView(g)),
        );

        if (this.params.organizationUserId) {
          this.loadOrganizationUser(userDetails, groups, collections);
        }

        this.loading = false;
      });
  }

  private setFormValidators(organization: Organization) {
    const emailsControlValidators = [
      Validators.required,
      commaSeparatedEmails,
      orgSeatLimitReachedValidator(
        organization,
        this.params.allOrganizationUserEmails,
        this.i18nService.t("subscriptionUpgrade", organization.seats),
      ),
    ];

    const emailsControl = this.formGroup.get("emails");
    emailsControl.setValidators(emailsControlValidators);
    emailsControl.updateValueAndValidity();
  }

  private loadOrganizationUser(
    userDetails: OrganizationUserAdminView,
    groups: GroupView[],
    collections: CollectionView[],
  ) {
    if (!userDetails) {
      throw new Error("Could not find user to edit.");
    }
    this.isRevoked = userDetails.status === OrganizationUserStatusType.Revoked;
    this.showNoMasterPasswordWarning =
      userDetails.status > OrganizationUserStatusType.Invited &&
      userDetails.hasMasterPassword === false;
    const assignedCollectionsPermissions = {
      editAssignedCollections: userDetails.permissions.editAssignedCollections,
      deleteAssignedCollections: userDetails.permissions.deleteAssignedCollections,
      manageAssignedCollections:
        userDetails.permissions.editAssignedCollections &&
        userDetails.permissions.deleteAssignedCollections,
    };
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
        manageAssignedCollectionsGroup: assignedCollectionsPermissions,
        manageAllCollectionsGroup: allCollectionsPermissions,
      });
    }

    const collectionsFromGroups = groups
      .filter((group) => userDetails.groups.includes(group.id))
      .flatMap((group) =>
        group.collections.map((accessSelection) => {
          const collection = collections.find((c) => c.id === accessSelection.id);
          return { group, collection, accessSelection };
        }),
      );

    this.collectionAccessItems = this.collectionAccessItems.concat(
      collectionsFromGroups.map(({ collection, accessSelection, group }) =>
        mapCollectionToAccessItemView(collection, accessSelection, group),
      ),
    );

    const accessSelections = mapToAccessSelections(userDetails);
    const groupAccessSelections = mapToGroupAccessSelections(userDetails.groups);

    this.formGroup.removeControl("emails");
    this.formGroup.patchValue({
      type: userDetails.type,
      externalId: userDetails.externalId,
      accessAllCollections: userDetails.accessAll,
      access: accessSelections,
      accessSecretsManager: userDetails.accessSecretsManager,
      groups: groupAccessSelections,
    });
  }

  check(c: CollectionView, select?: boolean) {
    (c as any).checked = select == null ? !(c as any).checked : select;
    if (!(c as any).checked) {
      c.readOnly = false;
    }
  }

  selectAll(select: boolean) {
    this.collections.forEach((c) => this.check(c, select));
  }

  setRequestPermissions(p: PermissionsApi, clearPermissions: boolean): PermissionsApi {
    if (clearPermissions) {
      return new PermissionsApi();
    }
    const partialPermissions: Partial<PermissionsApi> = {
      accessEventLogs: this.permissionsGroup.value.accessEventLogs,
      accessImportExport: this.permissionsGroup.value.accessImportExport,
      accessReports: this.permissionsGroup.value.accessReports,
      manageGroups: this.permissionsGroup.value.manageGroups,
      manageSso: this.permissionsGroup.value.manageSso,
      managePolicies: this.permissionsGroup.value.managePolicies,
      manageUsers: this.permissionsGroup.value.manageUsers,
      manageResetPassword: this.permissionsGroup.value.manageResetPassword,
      createNewCollections:
        this.permissionsGroup.value.manageAllCollectionsGroup.createNewCollections,
      editAnyCollection: this.permissionsGroup.value.manageAllCollectionsGroup.editAnyCollection,
      deleteAnyCollection:
        this.permissionsGroup.value.manageAllCollectionsGroup.deleteAnyCollection,
      editAssignedCollections:
        this.permissionsGroup.value.manageAssignedCollectionsGroup.editAssignedCollections,
      deleteAssignedCollections:
        this.permissionsGroup.value.manageAssignedCollectionsGroup.deleteAssignedCollections,
    };

    return Object.assign(p, partialPermissions);
  }

  handleDependentPermissions() {
    // Manage Password Reset (Account Recovery) must have Manage Users enabled
    if (
      this.permissionsGroup.value.manageResetPassword &&
      !this.permissionsGroup.value.manageUsers
    ) {
      this.permissionsGroup.value.manageUsers = true;
      (document.getElementById("manageUsers") as HTMLInputElement).checked = true;
      this.platformUtilsService.showToast(
        "info",
        null,
        this.i18nService.t("accountRecoveryManageUsers"),
      );
    }
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      if (this.tabIndex !== MemberDialogTab.Role) {
        this.platformUtilsService.showToast(
          "error",
          null,
          this.i18nService.t("fieldOnTabRequiresAttention", this.i18nService.t("role")),
        );
      }
      return;
    }

    const organization = await firstValueFrom(this.organization$);

    if (!organization.useCustomPermissions && this.customUserTypeSelected) {
      this.platformUtilsService.showToast(
        "error",
        null,
        this.i18nService.t("customNonEnterpriseError"),
      );
      return;
    }

    const userView = new OrganizationUserAdminView();
    userView.id = this.params.organizationUserId;
    userView.organizationId = this.params.organizationId;
    userView.accessAll = this.accessAllCollections;
    userView.type = this.formGroup.value.type;
    userView.permissions = this.setRequestPermissions(
      userView.permissions ?? new PermissionsApi(),
      userView.type !== OrganizationUserType.Custom,
    );
    userView.collections = this.formGroup.value.access
      .filter((v) => v.type === AccessItemType.Collection)
      .map(convertToSelectionView);

    userView.groups = (await firstValueFrom(this.restrictedAccess$))
      ? null
      : this.formGroup.value.groups.map((m) => m.id);

    userView.accessSecretsManager = this.formGroup.value.accessSecretsManager;

    if (this.editMode) {
      await this.userService.save(userView);
    } else {
      userView.id = this.params.organizationUserId;
      const maxEmailsCount = organization.planProductType === ProductType.TeamsStarter ? 10 : 20;
      const emails = [...new Set(this.formGroup.value.emails.trim().split(/\s*,\s*/))];
      if (emails.length > maxEmailsCount) {
        this.formGroup.controls.emails.setErrors({
          tooManyEmails: { message: this.i18nService.t("tooManyEmails", maxEmailsCount) },
        });
        return;
      }
      if (
        organization.hasReseller &&
        this.params.numConfirmedMembers + emails.length > organization.seats
      ) {
        this.formGroup.controls.emails.setErrors({
          tooManyEmails: { message: this.i18nService.t("seatLimitReachedContactYourProvider") },
        });
        return;
      }
      await this.userService.invite(emails, userView);
    }

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t(this.editMode ? "editedUserId" : "invitedUsers", this.params.name),
    );
    this.close(MemberDialogResult.Saved);
  };

  delete = async () => {
    if (!this.editMode) {
      return;
    }

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

    if (this.showNoMasterPasswordWarning) {
      confirmed = await this.noMasterPasswordConfirmationDialog();

      if (!confirmed) {
        return false;
      }
    }

    await this.organizationUserService.deleteOrganizationUser(
      this.params.organizationId,
      this.params.organizationUserId,
    );

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("removedUserId", this.params.name),
    );
    this.close(MemberDialogResult.Deleted);
  };

  revoke = async () => {
    if (!this.editMode) {
      return;
    }

    let confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "revokeUserId", placeholders: [this.params.name] },
      content: { key: "revokeUserConfirmation" },
      acceptButtonText: { key: "revokeAccess" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    if (this.showNoMasterPasswordWarning) {
      confirmed = await this.noMasterPasswordConfirmationDialog();

      if (!confirmed) {
        return false;
      }
    }

    await this.organizationUserService.revokeOrganizationUser(
      this.params.organizationId,
      this.params.organizationUserId,
    );

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("revokedUserId", this.params.name),
    );
    this.isRevoked = true;
    this.close(MemberDialogResult.Revoked);
  };

  restore = async () => {
    if (!this.editMode) {
      return;
    }

    await this.organizationUserService.restoreOrganizationUser(
      this.params.organizationId,
      this.params.organizationUserId,
    );

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("restoredUserId", this.params.name),
    );
    this.isRevoked = false;
    this.close(MemberDialogResult.Restored);
  };

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected async cancel() {
    this.close(MemberDialogResult.Canceled);
  }

  private close(result: MemberDialogResult) {
    this.dialogRef.close(result);
  }

  private noMasterPasswordConfirmationDialog() {
    return this.dialogService.openSimpleDialog({
      title: {
        key: "removeOrgUserNoMasterPasswordTitle",
      },
      content: {
        key: "removeOrgUserNoMasterPasswordDesc",
        placeholders: [this.params.name],
      },
      type: "warning",
    });
  }

  protected readonly ProductType = ProductType;
}

function mapCollectionToAccessItemView(
  collection: CollectionView,
  accessSelection?: CollectionAccessSelectionView,
  group?: GroupView,
): AccessItemView {
  return {
    type: AccessItemType.Collection,
    id: group ? `${collection.id}-${group.id}` : collection.id,
    labelName: collection.name,
    listName: collection.name,
    readonly: group !== undefined,
    readonlyPermission: accessSelection ? convertToPermission(accessSelection) : undefined,
    viaGroupName: group?.name,
  };
}

function mapGroupToAccessItemView(group: GroupView): AccessItemView {
  return {
    type: AccessItemType.Group,
    id: group.id,
    labelName: group.name,
    listName: group.name,
  };
}

function mapToAccessSelections(user: OrganizationUserAdminView): AccessItemValue[] {
  if (user == undefined) {
    return [];
  }
  return [].concat(
    user.collections.map<AccessItemValue>((selection) => ({
      id: selection.id,
      type: AccessItemType.Collection,
      permission: convertToPermission(selection),
    })),
  );
}

function mapToGroupAccessSelections(groups: string[]): AccessItemValue[] {
  if (groups == undefined) {
    return [];
  }
  return [].concat(
    groups.map((groupId) => ({
      id: groupId,
      type: AccessItemType.Group,
    })),
  );
}

/**
 * Strongly typed helper to open a UserDialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Configuration for the dialog
 */
export function openUserAddEditDialog(
  dialogService: DialogService,
  config: DialogConfig<MemberDialogParams>,
) {
  return dialogService.open<MemberDialogResult, MemberDialogParams>(MemberDialogComponent, config);
}
