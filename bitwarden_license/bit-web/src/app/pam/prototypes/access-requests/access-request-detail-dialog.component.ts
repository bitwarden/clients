import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

import { IconComponent as VaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import {
  BadgeComponent,
  BadgeVariant,
  ButtonModule,
  CalloutModule,
  CardComponent,
  CenterPositionStrategy,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconModule,
  InputModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

import {
  AccessRequestContext,
  AccessRequestDetailView,
  AccessRequestStatus,
  buildCipherForRequest,
  buildDetailFieldGroups,
} from "./access-request.model";

/** Which view the dialog currently shows. "withdraw" swaps the body for the destructive ask. */
export type AccessRequestDialogStep = "detail" | "withdraw";

export interface AccessRequestDetailDialogData {
  request: AccessRequestDetailView;
  context: AccessRequestContext;
  /** Open the dialog directly at the withdraw step (used by the row-level revoke shortcut). */
  initialStep?: AccessRequestDialogStep;
}

type RequestAction =
  | "approve"
  | "deny"
  | "withdraw"
  | "cancel"
  | "activate"
  | "revokeLease"
  | "endSession"
  | "resubmit";

type FooterAction = {
  key: RequestAction;
  label: string;
  style: "primary" | "danger" | "secondary";
  /** `true` pushes the button to the far right of the footer, past the Close button. */
  alignEnd?: boolean;
};

/**
 * Shared Access Request detail modal.
 *
 * Structure (same shell for every state × context):
 * - A top identity card: item icon + name, organization + folder chips, status badge.
 * - One `bit-section` + `bit-card` per cluster — Details, Decision, Session — so
 *   each group reads as its own object. Clusters only render once they have
 *   content, so the dialog grows with the lifecycle (see `buildDetailFieldGroups`).
 * - A footer whose primary action is `statusAction()` and always ends in `Close`.
 *
 * `statusAction()` + `fieldGroups()` are the two context-aware computeds; everything
 * else is presentation.
 */
@Component({
  selector: "pam-access-request-detail-dialog",
  templateUrl: "./access-request-detail-dialog.component.html",
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    CalloutModule,
    FormFieldModule,
    IconModule,
    InputModule,
    BadgeComponent,
    SectionComponent,
    SectionHeaderComponent,
    CardComponent,
    TypographyModule,
    VaultIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessRequestDetailDialogComponent {
  protected readonly dialogRef = inject(DialogRef, { optional: true });
  private readonly dialogData = inject<AccessRequestDetailDialogData | null>(DIALOG_DATA, {
    optional: true,
  });

  readonly request = input<AccessRequestDetailView>(
    this.dialogData?.request as AccessRequestDetailView,
  );
  readonly context = input<AccessRequestContext>(
    (this.dialogData?.context ?? "approvals") as AccessRequestContext,
  );
  readonly initialStep = input<AccessRequestDialogStep>(this.dialogData?.initialStep ?? "detail");

  readonly action = output<RequestAction>();
  readonly withdrawConfirmed = output<{ reason: string }>();

  /** Which pane the body + title + footer render. Flips to "withdraw" on confirm click. */
  protected readonly step = signal<AccessRequestDialogStep>(this.initialStep());

  /** Reason entered in the withdraw step. Required before the destructive action is enabled. */
  protected readonly reason = signal("");

  protected readonly title = computed(() =>
    this.step() === "withdraw" ? "Withdraw approval" : "Access request",
  );

  static open(
    dialogService: DialogService,
    data: AccessRequestDetailDialogData,
  ): DialogRef<void, AccessRequestDetailDialogComponent> {
    return dialogService.open(AccessRequestDetailDialogComponent, {
      data,
      positionStrategy: new CenterPositionStrategy(),
    });
  }

  protected readonly status = computed<AccessRequestStatus>(() => this.request().status);

  protected readonly cipher = computed(() => buildCipherForRequest(this.request()));

  protected readonly fieldGroups = computed(() => buildDetailFieldGroups(this.request()));

  /**
   * One badge recipe per state. Matches the Password Manager access-state badge spec:
   * - Pending: warning + bwi-clock
   * - Approved / Ready to use: success + bwi-check
   * - Active (lease held): accent-primary + bwi-unlock, label is the remaining time
   * - Ending soon (under 5m): danger + bwi-exclamation-triangle, label is `Ending soon · {N}m left`
   * - Expired lease (session ran out): subtle + bwi-lock, label is "Session ended"
   * - Expired request (approval window passed, no lease issued): subtle + bwi-clock, label is "Expired"
   * - Denied / Canceled: subtle terminal states, kept distinct from Session ended so the
   *   decision log reads correctly in the dialog.
   */
  protected readonly statusBadge = computed<{
    variant: BadgeVariant;
    label: string;
    icon?: string;
  }>(() => {
    const req = this.request();
    switch (req.status) {
      case "pending":
        return { variant: "warning", label: "Pending approval", icon: "bwi-clock" };
      case "approved":
      case "readyToUse":
        return { variant: "success", label: "Ready to use", icon: "bwi-check" };
      case "active":
        return {
          variant: "accent-primary",
          label: req.leaseRemaining ? `${req.leaseRemaining} left` : "Active",
          icon: "bwi-unlock",
        };
      case "endingSoon":
        return {
          variant: "danger",
          label: req.leaseRemaining ? `Ending soon · ${req.leaseRemaining} left` : "Ending soon",
          icon: "bwi-exclamation-triangle",
        };
      case "denied":
        // Danger variant to signal the negative outcome — kept bwi-lock to stay
        // consistent with the other terminal states (Session ended, Unavailable).
        return { variant: "danger", label: "Denied", icon: "bwi-lock" };
      case "canceled":
        return { variant: "subtle", label: "Canceled", icon: "bwi-lock" };
      case "expired":
        // Request-expired (no decision in window) uses danger to match Denied, since
        // the user ends up blocked for the same reason: no approval came through.
        return { variant: "danger", label: "Expired", icon: "bwi-lock" };
      case "revoked":
        // Approver cut a live lease short — distinct from a natural session end so
        // the history reads correctly.
        return { variant: "subtle", label: "Revoked", icon: "bwi-lock" };
      case "sessionEnded":
        // Lease ran out naturally OR the requester ended their own session; both
        // read as a neutral end-of-lease.
        return { variant: "subtle", label: "Session ended", icon: "bwi-lock" };
    }
  });

  /** The primary context-aware action rendered first in the footer (left of Close). */
  protected readonly footerActions = computed<FooterAction[]>(() => {
    const ctx = this.context();
    const status = this.status();

    if (ctx === "history") {
      return [];
    }

    if (ctx === "approvals") {
      switch (status) {
        case "pending":
          // Deny floats to the far right so it's visually separated from the Approve +
          // Close pair — makes the destructive action harder to mis-click.
          return [
            { key: "approve", label: "Approve", style: "primary" },
            { key: "deny", label: "Deny", style: "danger", alignEnd: true },
          ];
        case "approved":
        case "readyToUse":
          // Reversible — the approver can re-approve or the requester can submit again.
          // Keep as primary so it doesn't read as destructive as End session / Cancel request.
          return [{ key: "withdraw", label: "Withdraw approval", style: "primary" }];
        case "active":
        case "endingSoon":
          return [{ key: "revokeLease", label: "End session", style: "danger" }];
        default:
          return [];
      }
    }

    // my-requests
    switch (status) {
      case "pending":
        return [{ key: "cancel", label: "Cancel request", style: "primary" }];
      case "approved":
      case "readyToUse":
        return [{ key: "activate", label: "Start session", style: "primary" }];
      case "active":
      case "endingSoon":
        return [{ key: "endSession", label: "End access", style: "danger" }];
      case "denied":
      case "expired":
      case "canceled":
        return [{ key: "resubmit", label: "Submit new request", style: "primary" }];
      default:
        return [];
    }
  });

  /** Footer buttons that render on the left (primary actions). */
  protected readonly startActions = computed(() => this.footerActions().filter((a) => !a.alignEnd));

  /** Footer buttons pushed to the far right (destructive, separated to avoid mis-clicks). */
  protected readonly endActions = computed(() => this.footerActions().filter((a) => a.alignEnd));

  protected invoke(action: RequestAction): void {
    // Withdraw is a two-step destructive flow: the first click swaps the body to the
    // withdraw ask; the user confirms (or backs out) from that step. Every other
    // action still emits straight through for the host to handle.
    if (action === "withdraw") {
      this.step.set("withdraw");
      return;
    }
    this.action.emit(action);
  }

  protected backToDetail(): void {
    this.step.set("detail");
  }

  protected confirmWithdraw(): void {
    const reason = this.reason().trim();
    if (!reason) {
      return;
    }
    this.withdrawConfirmed.emit({ reason });
    void this.dialogRef?.close();
  }

  protected close(): void {
    void this.dialogRef?.close();
  }
}
