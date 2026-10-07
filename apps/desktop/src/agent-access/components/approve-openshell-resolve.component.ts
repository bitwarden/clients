import { DatePipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { Observable } from "rxjs";

import {
  BadgeComponent,
  ButtonModule,
  CalloutModule,
  CheckboxModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormControlModule,
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  OpenShellLifetimeMode,
  OpenShellRequestContext,
  openShellDigestPrefix,
} from "../models/openshell";

/** Which approval the dialog is asking for (§M8.5–§M8.6). */
export type ApproveOpenShellResolveMode =
  "firstRequest" | "policyChanged" | "windowExpired" | "previouslyApproved";

export interface ApproveOpenShellResolveParams {
  mode: ApproveOpenShellResolveMode;
  /** OS-verified identity of the gateway process (aac's parent). The only verified fact here. */
  gatewayIdentity: {
    signatureKind: string;
    signatureIdentity: string;
    exePath?: string;
    /** `false` (or absent) means the identity is path-only or the signature failed: the dialog
     *  says so instead of letting "verified" read stronger than it is. */
    signatureValid?: boolean;
  };
  /** Gateway-reported, never verified by Bitwarden. Always labelled so. */
  context: OpenShellRequestContext;
  /** Names resolved in the renderer from the unlocked vault. Never values. */
  targets: Array<{ credentialKey: string; label: string; fieldLabel: string }>;
  previousPolicyDigest?: string;
  /** `ttlMinutes` is set only when approving opens a new ttl window; `reusedWindow` marks an
   *  approval that continues the current, unextended window (its end is `expiresAtMs`). */
  lifetime: {
    mode: OpenShellLifetimeMode;
    expiresAtMs?: number;
    ttlMinutes?: number;
    reusedWindow?: boolean;
  };
  /** Remaining time to answer, in ms. The countdown starts at `floor((deadlineMs − 1000) / 1000)`. */
  deadlineMs: number;
  /** §M8.18: a new remaining time (ms) whenever an identical retry attaches and keeps this
   *  dialog open longer. The countdown only ever moves later, never earlier. */
  deadlineUpdates?: Observable<number>;
}

export type ApproveOpenShellResolveResult = "approved" | "denied" | "timeout";

/**
 * The single combined OpenShell approval dialog (agent-access-architecture.md, §M8.9): who is
 * asking (verified), what the gateway reports (not verified), which credentials, where they can
 * go, how long the approval lasts — plus, in every mode except `previouslyApproved`, the inline
 * first-use acknowledgement that must be ticked before Approve enables. It auto-denies as
 * `timeout` when the countdown reaches 0.
 *
 * Holds no credential values at any point: the service resolves them before opening the dialog
 * and keeps them in its own closure.
 */
@Component({
  selector: "app-approve-openshell-resolve",
  templateUrl: "approve-openshell-resolve.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    I18nPipe,
    ReactiveFormsModule,
    BadgeComponent,
    ButtonModule,
    CalloutModule,
    CheckboxModule,
    DialogModule,
    FormControlModule,
    ItemModule,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
  ],
})
export class ApproveOpenShellResolveComponent implements OnInit {
  protected readonly params = inject<ApproveOpenShellResolveParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<ApproveOpenShellResolveResult>>(DialogRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly acknowledgement = new FormControl(false, { nonNullable: true });
  private readonly acknowledged = signal(false);

  /** §M8.4: `floor((deadlineMs − 1000) / 1000)`, never negative. */
  protected readonly remainingSeconds = signal(
    Math.max(0, Math.floor((this.params.deadlineMs - 1000) / 1000)),
  );

  protected readonly requiresAcknowledgement = this.params.mode !== "previouslyApproved";

  protected readonly canApprove = computed(
    () => (!this.requiresAcknowledgement || this.acknowledged()) && this.remainingSeconds() > 0,
  );

  /** Unknown is shown as if `true` (§M8.4). */
  protected readonly showAdvisorWarning = this.params.context.advisorEnabled !== false;

  protected readonly digestPrefix = openShellDigestPrefix(this.params.context.policyDigest);
  protected readonly previousDigestPrefix =
    this.params.previousPolicyDigest != null
      ? openShellDigestPrefix(this.params.previousPolicyDigest)
      : undefined;

  protected readonly policyState: "new" | "changed" | "unchanged" =
    this.params.mode === "firstRequest"
      ? "new"
      : this.params.mode === "policyChanged"
        ? "changed"
        : "unchanged";

  /** Mutable lifecycle state (the dialog closes exactly once; the countdown interval). */
  private readonly lifecycle: { settled: boolean; timer?: ReturnType<typeof setInterval> } = {
    settled: false,
  };

  static open(dialogService: DialogService, params: ApproveOpenShellResolveParams) {
    return dialogService.open<ApproveOpenShellResolveResult, ApproveOpenShellResolveParams>(
      ApproveOpenShellResolveComponent,
      { data: params },
    );
  }

  ngOnInit(): void {
    this.acknowledgement.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.acknowledged.set(value === true));
    this.params.deadlineUpdates
      ?.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((remainingMs) => this.extendDeadline(remainingMs));

    if (this.remainingSeconds() <= 0) {
      void this.close("timeout");
      return;
    }
    this.lifecycle.timer = setInterval(() => this.tick(), 1000);
    this.destroyRef.onDestroy(() => this.clearTimer());
  }

  protected endpointLabel(endpoint: OpenShellRequestContext["endpoints"][number]): string {
    const base = `${endpoint.host}:${endpoint.port}`;
    return endpoint.path != null && endpoint.path.length > 0 ? `${base} ${endpoint.path}` : base;
  }

  /** The ttl duration in the unit the i18n keys offer. */
  protected ttlDuration(): { key: string; value: number } | undefined {
    const minutes = this.params.lifetime.ttlMinutes;
    if (this.params.lifetime.mode !== "ttl" || minutes == null) {
      return undefined;
    }
    return minutes < 60
      ? { key: "agentAccessOpenShellTtlMinutes", value: minutes }
      : { key: "agentAccessOpenShellTtlHours", value: minutes / 60 };
  }

  protected readonly approve = async () => {
    if (!this.canApprove()) {
      return;
    }
    await this.close("approved");
  };

  protected readonly deny = async () => {
    await this.close("denied");
  };

  private extendDeadline(remainingMs: number): void {
    if (this.lifecycle.settled || !Number.isFinite(remainingMs)) {
      return;
    }
    const seconds = Math.max(0, Math.floor((remainingMs - 1000) / 1000));
    if (seconds > this.remainingSeconds()) {
      this.remainingSeconds.set(seconds);
    }
  }

  private tick(): void {
    const next = this.remainingSeconds() - 1;
    this.remainingSeconds.set(Math.max(0, next));
    if (next <= 0) {
      void this.close("timeout");
    }
  }

  private clearTimer(): void {
    if (this.lifecycle.timer != null) {
      clearInterval(this.lifecycle.timer);
      this.lifecycle.timer = undefined;
    }
  }

  private async close(result: ApproveOpenShellResolveResult): Promise<void> {
    if (this.lifecycle.settled) {
      return;
    }
    this.lifecycle.settled = true;
    this.clearTimer();
    await this.dialogRef.close(result);
  }
}
