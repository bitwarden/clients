import { AsyncPipe, NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { combineLatest, firstValueFrom, map, Observable, of, shareReplay, switchMap } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { getById } from "@bitwarden/common/platform/misc";
import {
  A11yTitleDirective,
  AsyncActionsModule,
  ButtonModule,
  CheckboxModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  DisclosureComponent,
  DisclosureTriggerForDirective,
  FormFieldModule,
  IconModule,
  LinkModule,
  RadioButtonModule,
  SelectModule,
  TabsModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  GroupApiService,
  GroupDetailsView,
  OrganizationUserAdminView,
  UserAdminService,
} from "../../../core";
import { OrganizationUserView } from "../../../core/views/organization-user.view";
import {
  AccessItemType,
  AccessItemValue,
  AccessItemView,
  AccessSelectorModule,
  convertToSelectionView,
  PermissionMode,
} from "../../../shared/components/access-selector";
import { MemberDialogResult } from "../member-dialog/member-dialog.component";
import { commaSeparatedEmails } from "../member-dialog/validators/comma-separated-emails.validator";
import {
  getEmailBatchLimit,
  inputEmailLimitValidator,
} from "../member-dialog/validators/input-email-limit.validator";
import { revokedEmailsValidator } from "../member-dialog/validators/revoked-emails.validator";

import { ByLinkTabComponent } from "./by-link-tab.component";

export interface InviteMembersDialogParams {
  organizationId: string;
  isOnSecretsManagerStandalone: boolean;
  occupiedSeatCount: number;
  allOrganizationUsers: OrganizationUserView[];
}

@Component({
  standalone: true,
  selector: "app-invite-members-dialog",
  templateUrl: "invite-members-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    A11yTitleDirective,
    AccessSelectorModule,
    AsyncActionsModule,
    AsyncPipe,
    ButtonModule,
    ByLinkTabComponent,
    CheckboxModule,
    DialogModule,
    DisclosureComponent,
    DisclosureTriggerForDirective,
    FormFieldModule,
    I18nPipe,
    LinkModule,
    NgTemplateOutlet,
    RadioButtonModule,
    ReactiveFormsModule,
    SelectModule,
    TabsModule,
    IconModule,
  ],
})
export class InviteMembersDialogComponent {
  protected readonly params = inject<InviteMembersDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<MemberDialogResult>>(DialogRef);
  private readonly i18nService = inject(I18nService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly collectionAdminService = inject(CollectionAdminService);
  private readonly groupService = inject(GroupApiService);
  private readonly userService = inject(UserAdminService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly toastService = inject(ToastService);

  protected readonly organizationUserType = OrganizationUserType;
  protected readonly PermissionMode = PermissionMode;
  protected readonly isOnSecretsManagerStandalone = this.params.isOnSecretsManagerStandalone;
  protected readonly selectedTabIndex = signal(0);
  protected readonly moreSettingsOpen = signal(false);

  protected readonly formGroup = this.formBuilder.group({
    emails: [""],
    type: OrganizationUserType.User,
    accessSecretsManager: this.params.isOnSecretsManagerStandalone,
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

  protected readonly organization$: Observable<Organization> =
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.organizationService.organizations$(userId)),
      getById(this.params.organizationId),
      map((organization) => {
        if (organization == null) {
          throw new Error("Organization not found");
        }
        return organization;
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

  protected readonly allowAdminAccessToAllCollectionItems$: Observable<boolean> =
    this.organization$.pipe(
      map((organization) => organization.allowAdminAccessToAllCollectionItems),
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

  protected readonly remainingSeats$: Observable<number> = this.organization$.pipe(
    map((organization) => organization.seats - this.params.occupiedSeatCount),
  );

  private readonly groups$: Observable<GroupDetailsView[]> = this.organization$.pipe(
    switchMap((organization) =>
      organization.useGroups
        ? this.groupService.getAllDetails(this.params.organizationId)
        : of([] as GroupDetailsView[]),
    ),
  );

  private readonly collections$ = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) =>
      this.collectionAdminService.collectionAdminViews$(this.params.organizationId, userId),
    ),
  );

  protected readonly groupAccessItems$: Observable<AccessItemView[]> = this.groups$.pipe(
    map((groups) => groups.map((g) => mapGroupToAccessItemView(g))),
  );

  protected readonly collectionAccessItems$: Observable<AccessItemView[]> = combineLatest([
    this.collections$,
    this.organization$,
  ]).pipe(
    map(([collections, organization]) =>
      collections
        .map((c) => mapCollectionToAccessItemView(c, organization))
        .filter((item) => !item.readonly),
    ),
  );

  private readonly formTypeValue = toSignal(this.formGroup.controls.type.valueChanges, {
    initialValue: this.formGroup.value.type ?? OrganizationUserType.User,
  });
  protected readonly customUserTypeSelected = computed(
    () => this.formTypeValue() === OrganizationUserType.Custom,
  );

  constructor() {
    this.organization$.pipe(takeUntilDestroyed()).subscribe((organization) => {
      const emailBatchLimit = getEmailBatchLimit(organization, this.params.occupiedSeatCount);
      this.setFormValidators(emailBatchLimit);
    });
  }

  private setFormValidators(emailBatchLimit: number) {
    const emailsControlValidators = [
      Validators.required,
      commaSeparatedEmails,
      inputEmailLimitValidator(
        emailBatchLimit,
        (maxEmailsCount: number) => this.i18nService.t("tooManyEmails", maxEmailsCount),
        this.params.allOrganizationUsers.map((u) => u.email),
      ),
      revokedEmailsValidator(
        this.params.allOrganizationUsers,
        this.i18nService.t("revokedEmailError"),
      ),
    ];

    const emailsControl = this.formGroup.get("emails");
    emailsControl?.setValidators(emailsControlValidators);
    emailsControl?.updateValueAndValidity();
  }

  private setRequestPermissions(clearPermissions: boolean): PermissionsApi {
    if (clearPermissions) {
      return new PermissionsApi();
    }
    const { manageAllCollectionsGroup, ...permissionFields } = this.permissionsGroup.value;
    return Object.assign(new PermissionsApi(), {
      ...permissionFields,
      createNewCollections: manageAllCollectionsGroup?.createNewCollections,
      editAnyCollection: manageAllCollectionsGroup?.editAnyCollection,
      deleteAnyCollection: manageAllCollectionsGroup?.deleteAnyCollection,
    });
  }

  private async getUserView(): Promise<OrganizationUserAdminView> {
    const userView = new OrganizationUserAdminView();
    userView.organizationId = this.params.organizationId;
    userView.type = this.formGroup.value.type ?? OrganizationUserType.User;

    userView.permissions = this.setRequestPermissions(
      userView.type !== OrganizationUserType.Custom,
    );

    userView.collections = (this.formGroup.value.access ?? [])
      .filter((v) => v.type === AccessItemType.Collection)
      .map(convertToSelectionView);

    userView.groups = (this.formGroup.value.groups ?? []).map((m) => m.id);

    userView.accessSecretsManager = this.formGroup.value.accessSecretsManager ?? false;

    return userView;
  }

  private async handleInviteUsers(userView: OrganizationUserAdminView) {
    const emails = [...new Set((this.formGroup.value.emails ?? "").trim().split(/\s*,\s*/))];
    await this.userService.invite(emails, userView);

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("invitedUsers"),
    });
    this.close(MemberDialogResult.Saved);
  }

  readonly submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
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

    const userView = await this.getUserView();
    await this.handleInviteUsers(userView);
  };

  protected cancel() {
    this.close(MemberDialogResult.Canceled);
  }

  private close(result: MemberDialogResult) {
    void this.dialogRef.close(result);
  }

  static readonly open = (
    dialogService: DialogService,
    config: DialogConfig<InviteMembersDialogParams>,
  ) =>
    dialogService.open<MemberDialogResult, InviteMembersDialogParams>(
      InviteMembersDialogComponent,
      config,
    );
}

function mapCollectionToAccessItemView(
  collection: CollectionAdminView,
  organization: Organization,
): AccessItemView {
  return {
    type: AccessItemType.Collection,
    id: collection.id,
    labelName: collection.name,
    listName: collection.name,
    readonly: !collection.canEditUserAccess(organization),
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
