import { ChangeDetectionStrategy, Component, computed, inject, input, output } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { firstValueFrom, Observable } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BitTableV2Component,
  type BitwardenIcon,
  BulkActionComponent,
  BulkActionsBarComponent,
  BulkAdditionalActionComponent,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  BillingConstraintService,
  SeatLimitAction,
} from "@bitwarden/web-vault/app/billing/members/billing-constraint/billing-constraint.service";

import { MaxCheckedCount } from "../../../common/people-table-data-source";
import { OrganizationUserView } from "../../core/views/organization-user.view";
import { MemberActionsService } from "../services/member-actions/member-actions.service";
import { BulkActionResult, failUnreported } from "../services/member-actions/member-actions.types";
import { MemberDialogManagerService } from "../services/member-dialog-manager/member-dialog-manager.service";

export type MemberBulkAction =
  | "invite"
  | "confirm"
  | "resendInvite"
  | "restore"
  | "revoke"
  | "addToSecretsManager"
  | "addToPrivilegedControls"
  | "remove"
  | "delete";

type ActionRule = {
  action: MemberBulkAction;
  canPerformAction: (member: OrganizationUserView, organization: Organization) => boolean;
  /** The admin is left out of the action rather than blocking it. */
  excludesSelf?: true;
};

/** Array order is the bar order. */
const ACTION_RULES: ActionRule[] = [
  { action: "invite", canPerformAction: (member) => member.canSendInvite },
  { action: "confirm", canPerformAction: (member) => member.canConfirm },
  { action: "resendInvite", canPerformAction: (member) => member.canReinvite },
  { action: "restore", canPerformAction: (member, org) => member.canRestoreAccess(org) },
  {
    action: "revoke",
    canPerformAction: (member, org) => member.canRevokeAccess(org),
    excludesSelf: true,
  },
  {
    action: "addToSecretsManager",
    canPerformAction: (member, org) => member.canAddToSecretsManager(org),
  },
  {
    action: "addToPrivilegedControls",
    canPerformAction: (member, org) => member.canAddToPrivilegedControls(org),
  },
  {
    action: "remove",
    canPerformAction: (member, org) => member.canRemoveFromOrg(org),
    excludesSelf: true,
  },
  {
    action: "delete",
    canPerformAction: (member, org) => member.canDeleteAccount(org),
    excludesSelf: true,
  },
];

/** Revoke, Remove and Delete move to the overflow menu when a non-destructive action applies. */
const DESTRUCTIVE_ACTIONS: ReadonlySet<MemberBulkAction> = new Set(["revoke", "remove", "delete"]);

const ACTION_DISPLAY: Record<MemberBulkAction, { labelKey: string; icon: BitwardenIcon }> = {
  invite: { labelKey: "invite", icon: "bwi-envelope" },
  confirm: { labelKey: "confirm", icon: "bwi-check" },
  resendInvite: { labelKey: "resendInvite", icon: "bwi-envelope" },
  restore: { labelKey: "restoreAccess", icon: "bwi-plus-circle" },
  revoke: { labelKey: "revokeAccess", icon: "bwi-minus-circle" },
  addToSecretsManager: { labelKey: "activateSecretsManager", icon: "bwi-cog" },
  addToPrivilegedControls: { labelKey: "activatePrivilegedControls", icon: "bwi-shield" },
  remove: { labelKey: "remove", icon: "bwi-close" },
  delete: { labelKey: "delete", icon: "bwi-trash" },
};

/** The toast, and the failure dialog's title and summary, for one action's outcome. */
type ResultCopy = {
  success: (count: number) => string;
  failureTitle: (failed: number) => string;
  failureSummary: (failed: number, succeeded: number) => string;
};

type BarAction = {
  action: MemberBulkAction;
  labelKey: string;
  icon: BitwardenIcon;
  run: () => void;
};

/**
 * The Members v2 bulk actions bar. Shows the actions every selected member qualifies for, worked
 * out from the table's selection, so it updates on every selection change. Must sit inside the
 * members `bit-table-v2` (projected as its `bit-bulk-actions-bar`), which it reads the selection
 * and the display order from.
 */
@Component({
  selector: "app-members-bulk-actions-bar",
  templateUrl: "members-bulk-actions-bar.component.html",
  imports: [BulkActionsBarComponent, BulkActionComponent, BulkAdditionalActionComponent, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembersBulkActionsBarComponent {
  private readonly table = inject<BitTableV2Component<OrganizationUserView>>(BitTableV2Component);
  private readonly memberActionsService = inject(MemberActionsService);
  private readonly memberDialogManager = inject(MemberDialogManagerService);
  private readonly billingConstraint = inject(BillingConstraintService);
  private readonly organizationMetadataService = inject(OrganizationMetadataServiceAbstraction);
  private readonly configService = inject(ConfigService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);

  readonly organization = input.required<Organization>();

  /** Emits once an action has run and the selection is cleared, so the page reloads members. */
  readonly actionCompleted = output<void>();

  protected readonly isProcessing = this.memberActionsService.isProcessing;

  private readonly pamFlagEnabled = toSignal(this.configService.getFeatureFlag$(FeatureFlag.Pam), {
    initialValue: false,
  });

  private readonly selection = computed(() => this.table.selectionModel()?.selected() ?? []);

  /** The actions whose conditions every selected member meets, in bar order. */
  protected readonly available = computed<MemberBulkAction[]>(() => {
    const members = this.selection();
    const organization = this.organization();
    return ACTION_RULES.filter(
      ({ action }) => action !== "addToPrivilegedControls" || this.pamFlagEnabled(),
    )
      .filter(({ canPerformAction, excludesSelf }) => {
        const targets = excludesSelf
          ? members.filter((member) => !member.isSelf(organization))
          : members;
        // `[].every()` is true, so an empty target list must not qualify.
        return (
          targets.length > 0 && targets.every((member) => canPerformAction(member, organization))
        );
      })
      .map(({ action }) => action);
  });

  private readonly hasNonDestructiveAction = computed(() =>
    this.available().some((action) => !DESTRUCTIVE_ACTIONS.has(action)),
  );

  /** Shown in the bar, overflowing into its menu only when they don't fit. */
  protected readonly inlineActions = computed(() =>
    this.available()
      .filter((action) => !this.hasNonDestructiveAction() || !DESTRUCTIVE_ACTIONS.has(action))
      .map((action) => this.toBarAction(action)),
  );

  /** Always in the bar's menu: Revoke, Remove and Delete alongside a non-destructive action. */
  protected readonly menuActions = computed(() =>
    this.hasNonDestructiveAction()
      ? this.available()
          .filter((action) => DESTRUCTIVE_ACTIONS.has(action))
          .map((action) => this.toBarAction(action))
      : [],
  );

  private readonly runners: Partial<Record<MemberBulkAction, () => Promise<void>>> = {
    invite: () => this.invite(),
    resendInvite: () => this.resendInvite(),
    restore: () => this.restore(),
  };

  private toBarAction(action: MemberBulkAction): BarAction {
    return {
      action,
      ...ACTION_DISPLAY[action],
      // Confirm, Revoke, Add to Secrets Manager, Add to Privileged Controls, Remove and Delete are
      // wired in later tickets of this stack; until then they show but do nothing.
      run: () => void this.runners[action]?.(),
    };
  }

  private async invite(): Promise<void> {
    const organization = this.organization();
    if (await this.seatLimitBlocks(organization, "invite")) {
      return;
    }

    const members = this.limitToMaxChecked(this.selectedInTableOrder());
    await this.runAction(
      members,
      this.memberActionsService.bulkSendInvite(
        organization,
        members.map((member) => member.id),
      ),
      this.inviteCopy,
    );
  }

  /** Sends to every selected member, in batches, rather than stopping at {@link MaxCheckedCount}. */
  private async resendInvite(): Promise<void> {
    const members = this.selectedInTableOrder();
    await this.runAction(
      members,
      this.memberActionsService.bulkReinvite(this.organization(), members, { offerRetry: false }),
      this.inviteCopy,
    );
  }

  private async restore(): Promise<void> {
    const organization = this.organization();
    if (await this.seatLimitBlocks(organization, "restore")) {
      return;
    }

    const members = this.limitToMaxChecked(this.selectedInTableOrder());
    await this.runAction(
      members,
      this.memberActionsService.bulkRestore(
        organization,
        members.map((member) => member.id),
      ),
      this.restoreCopy,
    );
  }

  /**
   * Sends without a confirmation dialog, then toasts when every member succeeded or lists the
   * failures. Either way the selection clears and the members reload.
   */
  private async runAction(
    members: OrganizationUserView[],
    request: Observable<BulkActionResult>,
    copy: ResultCopy,
  ): Promise<void> {
    const result = failUnreported(
      members.map((member) => member.id),
      await firstValueFrom(request),
      this.i18nService.t("bulkFilteredMessage"),
    );

    if (result.failed.length === 0) {
      this.toastService.showToast({
        variant: "success",
        message: copy.success(result.successful.length),
      });
    } else {
      const failedIds = new Set(result.failed.map((row) => row.id));
      await this.memberDialogManager.openBulkActionFailureDialog(
        members.filter((member) => failedIds.has(member.id)),
        result.failed,
        copy.failureTitle(result.failed.length),
        copy.failureSummary(result.failed.length, result.successful.length),
      );
    }

    this.table.selectionModel()?.clear();
    this.actionCompleted.emit();
  }

  /**
   * The selected members in the table's display order. The selection keeps click order, so it's
   * sorted against the table's rows; selected members the filters now hide follow the visible ones.
   */
  private selectedInTableOrder(): OrganizationUserView[] {
    const selected = new Set(this.selection());
    const visible = this.table.sorted().filter((row) => selected.has(row));
    const visibleSet = new Set(visible);
    return [...visible, ...this.selection().filter((member) => !visibleSet.has(member))];
  }

  /** Keeps the first {@link MaxCheckedCount} members and unselects the rest, as the v1 page does. */
  private limitToMaxChecked(members: OrganizationUserView[]): OrganizationUserView[] {
    const excess = members.slice(MaxCheckedCount);
    if (excess.length > 0) {
      this.table.selectionModel()?.deselect(...excess);
    }
    return members.slice(0, MaxCheckedCount);
  }

  /** Runs the existing seat limit flow, as the row actions and the v1 page do. */
  private async seatLimitBlocks(
    organization: Organization,
    action: SeatLimitAction,
  ): Promise<boolean> {
    const billingMetadata = await firstValueFrom(
      this.organizationMetadataService.getOrganizationMetadata$(organization.id),
    );
    const seatLimitResult = this.billingConstraint.checkSeatLimit(organization, billingMetadata);
    return await this.billingConstraint.seatLimitReached(seatLimitResult, organization, action);
  }

  /** Resend invite uses Invite's copy. */
  private readonly inviteCopy: ResultCopy = {
    success: (count) =>
      count === 1
        ? this.i18nService.t("inviteSentToast")
        : this.i18nService.t("invitesSentToast", count.toString()),
    failureTitle: (failed) =>
      failed === 1
        ? this.i18nService.t("inviteDidNotSendTitle")
        : this.i18nService.t("invitesDidNotSendTitle", failed.toString()),
    failureSummary: (failed, succeeded) =>
      this.i18nService.t("invitesDidNotSendSummary", failed.toString(), succeeded.toString()),
  };

  private readonly restoreCopy: ResultCopy = {
    success: (count) =>
      count === 1
        ? this.i18nService.t("memberRestoredToast")
        : this.i18nService.t("membersRestoredToast", count.toString()),
    failureTitle: (failed) =>
      failed === 1
        ? this.i18nService.t("memberAccessNotRestoredTitle")
        : this.i18nService.t("membersAccessNotRestoredTitle", failed.toString()),
    failureSummary: (failed, succeeded) =>
      this.i18nService.t("membersNotRestoredSummary", failed.toString(), succeeded.toString()),
  };
}
