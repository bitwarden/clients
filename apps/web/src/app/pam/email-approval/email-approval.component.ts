import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, input, signal } from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { Router } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  ButtonModule,
  FormFieldModule,
  IconModule,
  LinkModule,
  ToastService,
  TooltipDirective,
  TypographyModule,
} from "@bitwarden/components";
import {
  InboxLeaseRequestResponse,
  LeaseDecision,
  LeaseDecisionRequest,
  PamApiService,
  canApprove,
} from "@bitwarden/pam";

/**
 * Approval-only surface rendered when the approver follows an email deep-link
 * and the vault is locked. The vault key is never available here — this
 * component intentionally has no cipher-decryption paths.
 *
 * After a decision the component transitions to the confirmation view; the
 * vault remains locked throughout.
 */
@Component({
  selector: "pam-email-approval",
  templateUrl: "./email-approval.component.html",
  imports: [
    CommonModule,
    ReactiveFormsModule,
    JslibModule,
    ButtonModule,
    FormFieldModule,
    IconModule,
    LinkModule,
    TooltipDirective,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailApprovalComponent {
  private readonly pamApiService = inject(PamApiService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly router = inject(Router);

  readonly request = input.required<InboxLeaseRequestResponse>();
  readonly currentUserId = input<string | null>(null);

  protected readonly pendingDecision = signal<LeaseDecision | null>(null);
  protected readonly submitting = signal<boolean>(false);
  protected readonly confirmedDecision = signal<LeaseDecision | null>(null);
  protected readonly commentControl = new FormControl<string>("", { nonNullable: true });

  protected get canDecide(): boolean {
    const userId = this.currentUserId();
    if (userId == null) {
      return false;
    }
    return canApprove({ requesterUserId: this.request().requesterUserId }, { id: userId });
  }

  protected get disabledTooltip(): string {
    return this.canDecide ? "" : this.i18nService.t("pamInboxCannotApproveOwn");
  }

  protected beginDecision(decision: LeaseDecision): void {
    if (!this.canDecide || this.submitting()) {
      return;
    }
    this.pendingDecision.set(decision);
  }

  protected cancelDecision(): void {
    if (this.submitting()) {
      return;
    }
    this.pendingDecision.set(null);
    this.commentControl.reset("");
  }

  protected async confirmDecision(): Promise<void> {
    const decision = this.pendingDecision();
    if (decision == null || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    const comment = this.commentControl.value.trim();
    try {
      await this.pamApiService.submitDecision(
        this.request().id,
        new LeaseDecisionRequest({ decision, comment: comment.length > 0 ? comment : undefined }),
      );
      this.confirmedDecision.set(decision);
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("pamInboxDecisionFailed"),
      });
      this.submitting.set(false);
      this.pendingDecision.set(null);
      this.commentControl.reset("");
    }
  }

  protected navigateToInbox(): void {
    void this.router.navigate(["/pam/approver-inbox"]);
  }
}
