import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  ButtonModule,
  IconModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import {
  LeaseEventKind,
  LeaseEventService,
  LeaseRequestResponse,
  PamApiService,
} from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Visual states for the pending-state block.
 *
 * - `pending`  — waiting for an approver decision; shows elapsed time + approver list.
 * - `denied`   — request was denied; shows lock icon + reason; no retry.
 */
export const PendingBlockState = Object.freeze({
  Pending: "pending",
  Denied: "denied",
} as const);
export type PendingBlockState = (typeof PendingBlockState)[keyof typeof PendingBlockState];

/**
 * Inline block rendered inside the cipher view when the gated-cipher fetch
 * returned 202 (PM-37265). Replaces the secret-field area while the request is
 * pending.
 *
 * Subscribes to push events via {@link LeaseEventService}:
 *   - `approved` → emits {@link approved} so the parent can re-fetch the cipher.
 *   - `denied`   → flips to the denial state inline.
 *
 * The "Cancel request" button calls DELETE and emits {@link cancelled} so the
 * parent can return the cipher view to its pre-open state.
 *
 * TBD: the approver list ("Notified: Alex, Bo, Casey, +3") is not yet available
 * from the API. The server-side pending payload does not carry approver names in
 * v0. Until PM-37265 follow-up wires that data source, the block renders a
 * placeholder "Awaiting approval" string. See {@link approverSummary}.
 */
@Component({
  standalone: true,
  selector: "app-pam-pending-state",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./pending-state.component.html",
  imports: [CommonModule, ButtonModule, TypographyModule, IconModule, I18nPipe],
})
export class PendingStateComponent implements OnInit {
  /** The server-issued pending lease request. */
  readonly request = input.required<LeaseRequestResponse>();

  /** Emitted when the server approves — parent should re-fetch the cipher. */
  readonly approved = output<void>();

  /** Emitted after a successful cancel — parent should reset to pre-open state. */
  readonly cancelled = output<void>();

  private readonly pamApi = inject(PamApiService);
  private readonly leaseEventService = inject(LeaseEventService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly blockState = signal<PendingBlockState>(PendingBlockState.Pending);
  protected readonly denialReason = signal<string | null>(null);
  protected readonly cancelling = signal(false);

  /** Stable "now" so elapsed time renders consistently per tick. */
  private readonly now = signal(Date.now());

  protected readonly elapsedLabel = computed(() => formatElapsed(this.now(), this.request()));

  /**
   * TBD (PM-37265 follow-up): the server-side payload for pending requests does not
   * yet carry an approver display-name list. Until that endpoint is wired, the
   * approver list renders a placeholder "Awaiting approval" string.
   * When the API surfaces approver names, replace this computed with real data.
   */
  protected readonly approverSummary = computed(() =>
    this.i18nService.t("pendingStateApproversTbd"),
  );

  protected readonly isPending = computed(
    () => this.blockState() === PendingBlockState.Pending,
  );
  protected readonly isDenied = computed(() => this.blockState() === PendingBlockState.Denied);

  constructor() {
    // Update elapsed label every minute; DestroyRef ensures cleanup on teardown.
    const intervalId = setInterval(() => this.now.set(Date.now()), 60_000);
    this.destroyRef.onDestroy(() => clearInterval(intervalId));
  }

  ngOnInit(): void {
    // ngOnInit is required here because signal inputs are not yet resolved in
    // the constructor — `this.request()` is only valid after Angular has set
    // the input binding (which happens between construction and ngOnInit).
    this.leaseEventService
      .events$(this.request().id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.kind === LeaseEventKind.Approved) {
          this.approved.emit();
        } else if (event.kind === LeaseEventKind.Denied) {
          this.denialReason.set(null);
          this.blockState.set(PendingBlockState.Denied);
        }
      });
  }

  protected async cancelRequest(): Promise<void> {
    if (this.cancelling()) {
      return;
    }
    this.cancelling.set(true);
    try {
      await this.pamApi.cancelLeaseRequest(this.request().id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pendingStateCancelSuccess"),
      });
      this.cancelled.emit();
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pendingStateCancelError"),
      });
    } finally {
      this.cancelling.set(false);
    }
  }
}

/**
 * Returns a human-readable elapsed string (e.g. "5m", "2h", "2h 15m") since
 * the request was submitted.
 */
export function formatElapsed(
  nowMs: number,
  request: Pick<LeaseRequestResponse, "submittedAt">,
): string {
  const elapsedMs = nowMs - new Date(request.submittedAt).getTime();
  const totalMinutes = Math.max(0, Math.floor(elapsedMs / 60_000));
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
