import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { lastValueFrom } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  ButtonModule,
  CalloutModule,
  DialogService,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { BulkRevokeResult, PamApiService } from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

import { KillSwitchDialogComponent, KillSwitchDialogResult } from "./kill-switch-dialog.component";

export type KillSwitchState =
  | { kind: "idle" }
  | { kind: "success"; revokedCount: number }
  | { kind: "partial"; revokedCount: number; failedCount: number };

@Component({
  selector: "app-pam-kill-switch",
  templateUrl: "./kill-switch.component.html",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonModule, CalloutModule, TypographyModule, I18nPipe],
})
export class KillSwitchComponent implements OnInit {
  private readonly pamApiService = inject(PamApiService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly configService = inject(ConfigService);

  readonly organizationId = input.required<string>();
  readonly organizationName = input.required<string>();

  protected readonly killSwitchEnabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.Pam),
    { initialValue: false },
  );

  protected readonly state = signal<KillSwitchState>({ kind: "idle" });
  protected readonly submitting = signal(false);
  /** Whether the kill switch should also engage an org-wide leasing freeze. */
  protected readonly blockNewLeases = signal(false);
  /** Whether the org is currently under a leasing freeze (LeasingFreeze present). */
  protected readonly isFrozen = signal(false);
  /** True while the unblock request is in flight. */
  protected readonly unblocking = signal(false);

  async ngOnInit(): Promise<void> {
    await this.refreshFreezeState();
  }

  private async refreshFreezeState(): Promise<void> {
    try {
      this.isFrozen.set(Boolean(await this.pamApiService.isLeasingFrozen(this.organizationId())));
    } catch (e) {
      this.logService.error(e);
    }
  }

  protected toggleBlockNewLeases(event: Event): void {
    this.blockNewLeases.set((event.target as HTMLInputElement).checked);
  }

  protected async unblockNewLeases(): Promise<void> {
    this.unblocking.set(true);
    try {
      await this.pamApiService.unblockNewLeases(this.organizationId());
      await this.refreshFreezeState();
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("killSwitchUnblockSuccessMessage"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("killSwitchErrorMessage"),
      });
    } finally {
      this.unblocking.set(false);
    }
  }

  protected readonly isSuccess = computed(() => this.state().kind === "success");
  protected readonly isPartial = computed(() => this.state().kind === "partial");

  protected readonly successCount = computed(() => {
    const s = this.state();
    return s.kind === "success" ? s.revokedCount : 0;
  });

  protected readonly partialRevokedCount = computed(() => {
    const s = this.state();
    return s.kind === "partial" ? s.revokedCount : 0;
  });

  protected readonly partialFailedCount = computed(() => {
    const s = this.state();
    return s.kind === "partial" ? s.failedCount : 0;
  });

  protected async openKillSwitchDialog(): Promise<void> {
    const ref = KillSwitchDialogComponent.open(this.dialogService, {
      data: { organizationName: this.organizationName() },
    });

    const result = await lastValueFrom(ref.closed);

    if (result !== KillSwitchDialogResult.Confirmed) {
      return;
    }

    await this.executeKillSwitch();
  }

  private async executeKillSwitch(): Promise<void> {
    this.submitting.set(true);
    try {
      const result: BulkRevokeResult = await this.pamApiService.bulkRevokeLeases(
        this.organizationId(),
        this.blockNewLeases(),
      );

      if (result.kind === "ok") {
        // Reflect a freshly-engaged freeze in the callout.
        await this.refreshFreezeState();
        this.state.set({ kind: "success", revokedCount: result.revokedCount });
        this.toastService.showToast({
          variant: "success",
          title: this.i18nService.t("killSwitchSuccessTitle"),
          message: this.i18nService.t("killSwitchSuccessMessage", String(result.revokedCount)),
        });
      } else {
        this.state.set({
          kind: "partial",
          revokedCount: result.revokedCount,
          failedCount: result.failedCount,
        });
      }
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("killSwitchErrorMessage"),
      });
    } finally {
      this.submitting.set(false);
    }
  }
}
