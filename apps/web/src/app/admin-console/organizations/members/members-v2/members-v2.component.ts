import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import {
  combineLatest,
  concatMap,
  filter,
  firstValueFrom,
  from,
  map,
  Observable,
  shareReplay,
  switchMap,
  take,
} from "rxjs";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { RegistrationUserAddIcon } from "@bitwarden/assets/svg";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { OrganizationBillingMetadataResponse } from "@bitwarden/common/billing/models/response/organization-billing-metadata.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { getById } from "@bitwarden/common/platform/misc";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTablePaginatorComponent,
  BitTableV2Component,
  defineTable,
  IconModule,
  type SelectionConfig,
  StatusLockupComponent,
  SvgComponent,
  type TablePaginatorRange,
  ToastService,
} from "@bitwarden/components";
import { OrganizationUserStatusType } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";
import { Vfo1I18nPipe, Vfo1IconPipe } from "@bitwarden/vault";
import {
  BillingConstraintService,
  SeatLimitAction,
} from "@bitwarden/web-vault/app/billing/members/billing-constraint/billing-constraint.service";

import { HeaderModule } from "../../../../layouts/header/header.module";
import { MaxCheckedCount } from "../../../common/people-table-data-source";
import { OrganizationUserView } from "../../core/views/organization-user.view";
import { SharedOrganizationModule } from "../../shared";
import { AccountRecoveryDialogResultType } from "../components/account-recovery";
import { MemberDialogResult, MemberDialogTab } from "../components/member-dialog";
import { AvatarIdPipe } from "../pipes";
import { MemberDialogManagerService, OrganizationMembersService } from "../services";
import { MemberActionsService } from "../services/member-actions/member-actions.service";
import { MemberActionResult } from "../services/member-actions/member-actions.types";

/** Badge text and variant per status, listed in the order the Status column sorts. */
const STATUS_BADGES = [
  { status: OrganizationUserStatusType.Staged, labelKey: "staged", variant: "secondary" },
  { status: OrganizationUserStatusType.Invited, labelKey: "invited", variant: "secondary" },
  {
    status: OrganizationUserStatusType.Accepted,
    labelKey: "needsConfirmation",
    variant: "warning",
  },
  { status: OrganizationUserStatusType.Confirmed, labelKey: "active", variant: "success" },
  { status: OrganizationUserStatusType.Revoked, labelKey: "revoked", variant: "secondary" },
] as const;

type StatusBadge = (typeof STATUS_BADGES)[number];

@Component({
  templateUrl: "members-v2.component.html",
  imports: [
    AvatarIdPipe,
    BitCellComponent,
    BitCellDefDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitTablePaginatorComponent,
    BitTableV2Component,
    HeaderModule,
    IconModule,
    SharedOrganizationModule,
    StatusLockupComponent,
    SvgComponent,
    Vfo1I18nPipe,
    Vfo1IconPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembersV2Component {
  private readonly route = inject(ActivatedRoute);
  private readonly i18nService = inject(I18nService);
  private readonly organizationService = inject(OrganizationService);
  private readonly accountService = inject(AccountService);
  private readonly memberService = inject(OrganizationMembersService);
  private readonly memberActionsService = inject(MemberActionsService);
  private readonly memberDialogManager = inject(MemberDialogManagerService);
  private readonly billingConstraint = inject(BillingConstraintService);
  private readonly organizationMetadataService = inject(OrganizationMetadataServiceAbstraction);
  private readonly policyService = inject(PolicyService);
  private readonly policyApiService = inject(PolicyApiServiceAbstraction);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  private readonly userNamePipe = inject(UserNamePipe);

  private readonly userId$: Observable<UserId> = this.accountService.activeAccount$.pipe(getUserId);

  protected readonly emptyIcon = RegistrationUserAddIcon;
  protected readonly memberTab = MemberDialogTab;
  protected readonly userStatusType = OrganizationUserStatusType;

  private readonly organization$ = this.route.params.pipe(
    concatMap((params) =>
      this.userId$.pipe(
        switchMap((userId) =>
          this.organizationService.organizations$(userId).pipe(getById(params.organizationId)),
        ),
        filter((organization): organization is Organization => organization != null),
      ),
    ),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  protected readonly organization = toSignal(this.organization$);

  protected readonly members = signal<OrganizationUserView[]>([]);
  protected readonly firstLoaded = signal(false);
  protected readonly isProcessing = this.memberActionsService.isProcessing;
  protected readonly table = defineTable<OrganizationUserView, "options">(this.members);

  protected readonly showUserManagementControls = computed(
    () => this.organization()?.canManageUsers ?? false,
  );

  /** Select all stops at {@link MaxCheckedCount}, the most members a bulk action accepts. */
  protected readonly selection = computed<SelectionConfig<OrganizationUserView> | undefined>(() =>
    this.showUserManagementControls() ? { multiple: true, max: MaxCheckedCount } : undefined,
  );

  /**
   * Groups for organizations that use them, otherwise collections, as in v1. Options only for
   * admins who can manage users.
   */
  protected readonly displayedColumns = computed(() => [
    "name" as const,
    "status" as const,
    "type" as const,
    this.organization()?.useGroups ? ("groupNames" as const) : ("collectionNames" as const),
    ...(this.showUserManagementControls() ? ["options" as const] : []),
  ]);

  private readonly policies$ = combineLatest([this.userId$, this.organization$]).pipe(
    switchMap(([userId, organization]) =>
      organization.isProviderUser
        ? from(this.policyApiService.getPolicies(organization.id)).pipe(
            map((response) => Policy.fromListResponse(response)),
          )
        : this.policyService.policies$(userId),
    ),
  );

  protected readonly resetPasswordPolicyEnabled = toSignal(
    combineLatest([this.organization$, this.policies$]).pipe(
      map(
        ([organization, policies]) =>
          policies.find(
            (p) => p.type === PolicyType.ResetPassword && p.organizationId === organization.id,
          )?.enabled ?? false,
      ),
    ),
    { initialValue: false },
  );

  private readonly billingMetadata$: Observable<OrganizationBillingMetadataResponse> =
    this.organization$.pipe(
      switchMap((organization) =>
        this.organizationMetadataService.getOrganizationMetadata$(organization.id),
      ),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

  constructor() {
    this.organization$
      .pipe(
        switchMap((organization) => this.load(organization)),
        takeUntilDestroyed(),
      )
      .subscribe();

    // Stripe is slow, so kick this off in the background but without blocking page load.
    // Anyone who needs it will still await the first emission.
    this.billingMetadata$.pipe(take(1), takeUntilDestroyed()).subscribe();
  }

  async load(organization: Organization) {
    this.members.set(await this.memberService.loadUsers(organization));
    this.firstLoaded.set(true);
  }

  async edit(
    user: OrganizationUserView,
    organization: Organization,
    initialTab: MemberDialogTab = MemberDialogTab.Details,
  ) {
    const billingMetadata = await firstValueFrom(this.billingMetadata$);
    const result = await this.memberDialogManager.openEditDialog(
      user,
      organization,
      billingMetadata,
      initialTab,
    );

    switch (result) {
      case MemberDialogResult.Deleted:
      case MemberDialogResult.Saved:
      case MemberDialogResult.Revoked:
      case MemberDialogResult.Restored:
        await this.load(organization);
        break;
    }
  }

  async sendInvite(user: OrganizationUserView, organization: Organization) {
    if (await this.seatLimitBlocks(organization)) {
      return;
    }

    const result = await firstValueFrom(
      this.memberActionsService.sendInvite(organization, user.id),
    );
    await this.handleMemberActionResult(result, "hasBeenInvited", user, organization);
  }

  async reinvite(user: OrganizationUserView, organization: Organization) {
    const result = await firstValueFrom(
      this.memberActionsService.reinviteUser(organization, user.id),
    );
    await this.handleMemberActionResult(result, "hasBeenReinvited", user, organization);
  }

  async confirm(user: OrganizationUserView, organization: Organization) {
    const publicKeyResult = await this.memberActionsService.getPublicKeyForConfirm(user);

    if (publicKeyResult == null) {
      this.logService.warning("Public key not found");
      return;
    }

    const result = await this.memberActionsService.confirmUser(user, publicKeyResult, organization);
    await this.handleMemberActionResult(result, "hasBeenConfirmed", user, organization);
  }

  openEventsDialog(user: OrganizationUserView, organization: Organization) {
    this.memberDialogManager.openEventsDialog(user, organization);
  }

  allowResetPassword(user: OrganizationUserView, organization: Organization): boolean {
    return this.memberActionsService.allowResetPassword(
      user,
      organization,
      this.resetPasswordPolicyEnabled(),
    );
  }

  async resetPassword(user: OrganizationUserView, organization: Organization) {
    if (!user || !user.email || !user.id) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("orgUserDetailsNotFound"),
      });
      this.logService.error("Org user details not found when attempting account recovery");
      return;
    }

    const result = await this.memberDialogManager.openAccountRecoveryDialog(user, organization);
    if (result === AccountRecoveryDialogResultType.Ok) {
      await this.load(organization);
    }
  }

  async restore(user: OrganizationUserView, organization: Organization) {
    if (await this.seatLimitBlocks(organization, "restore")) {
      return;
    }

    const result = await this.memberActionsService.restoreUser(organization, user.id);
    await this.handleMemberActionResult(result, "restoredUserId", user, organization);
  }

  async revoke(user: OrganizationUserView, organization: Organization) {
    if (!(await this.memberDialogManager.openRevokeUserConfirmationDialog(user))) {
      return;
    }

    const result = await this.memberActionsService.revokeUser(organization, user.id);
    await this.handleMemberActionResult(result, "revokedUserId", user, organization);
  }

  async remove(user: OrganizationUserView, organization: Organization) {
    if (!(await this.memberDialogManager.openRemoveUserConfirmationDialog(user))) {
      return;
    }

    const result = await this.memberActionsService.removeUser(organization, user.id);
    await this.handleMemberActionResult(result, "removedUserId", user, organization);
  }

  async deleteUser(user: OrganizationUserView, organization: Organization) {
    if (!(await this.memberDialogManager.openDeleteUserConfirmationDialog(user, organization))) {
      return;
    }

    const result = await this.memberActionsService.deleteUser(organization, user.id);
    await this.handleMemberActionResult(result, "organizationUserDeleted", user, organization);
  }

  /** Toasts the outcome of a row action and, when it succeeded, reloads the members. */
  private async handleMemberActionResult(
    result: MemberActionResult,
    successKey: string,
    user: OrganizationUserView,
    organization: Organization,
  ) {
    if (result.success === false) {
      this.toastService.showToast({ variant: "error", message: result.error });
      this.logService.error(result.error);
      return;
    }

    if (result.success) {
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(successKey, this.userNamePipe.transform(user)),
      });
      await this.load(organization);
    }
  }

  /**
   * Prompts to upgrade when the organization has no seat available and its plan cannot autoscale.
   * Gates inviting a staged member and restoring a revoked one, as on the v1 page.
   */
  private async seatLimitBlocks(
    organization: Organization,
    action: SeatLimitAction = "invite",
  ): Promise<boolean> {
    const billingMetadata = await firstValueFrom(this.billingMetadata$);
    const seatLimitResult = this.billingConstraint.checkSeatLimit(organization, billingMetadata);
    return await this.billingConstraint.seatLimitReached(seatLimitResult, organization, action);
  }

  protected statusBadge(status: OrganizationUserStatusType): StatusBadge | undefined {
    return STATUS_BADGES.find((badge) => badge.status === status);
  }

  protected readonly sortByName = (a: OrganizationUserView, b: OrganizationUserView) =>
    this.compareText(a.name ?? a.email, b.name ?? b.email);

  protected readonly sortByStatus = (a: OrganizationUserView, b: OrganizationUserView) =>
    statusOrder(a.status) - statusOrder(b.status);

  /** Orders by the first name shown in the badge, then by how many more there are. */
  protected readonly sortByFirstName = (a: string[], b: string[]) =>
    this.compareText(a[0] ?? "", b[0] ?? "") || a.length - b.length;

  protected readonly sortByGroups = (a: OrganizationUserView, b: OrganizationUserView) =>
    this.sortByFirstName(a.groupNames, b.groupNames);

  protected readonly sortByCollections = (a: OrganizationUserView, b: OrganizationUserView) =>
    this.sortByFirstName(a.collectionNames, b.collectionNames);

  protected readonly rangeLabel = ({ start, end, total }: TablePaginatorRange) => {
    if (total === 0) {
      return this.i18nService.t("memberCount", "0");
    }
    if (total === 1) {
      return this.i18nService.t("memberCountSingular");
    }
    return this.i18nService.t(
      "memberRangeOfTotal",
      start.toString(),
      end.toString(),
      total.toString(),
    );
  };

  private compareText(a: string, b: string): number {
    return this.i18nService.collator?.compare(a, b) ?? a.localeCompare(b);
  }
}

function statusOrder(status: OrganizationUserStatusType): number {
  const index = STATUS_BADGES.findIndex((badge) => badge.status === status);
  return index === -1 ? STATUS_BADGES.length : index;
}
