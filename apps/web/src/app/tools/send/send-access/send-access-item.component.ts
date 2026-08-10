import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnDestroy,
  OnInit,
  signal,
} from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendAccessView } from "@bitwarden/common/tools/send/models/view/send-access.view";
import { ItemField } from "@bitwarden/common/tools/send/models/view/send-item.view";
import { CipherType } from "@bitwarden/common/vault/enums";
import { ToastService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";

@Component({
  selector: "app-send-access-item",
  templateUrl: "send-access-item.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendAccessItemComponent implements OnInit, OnDestroy {
  readonly send = input.required<SendAccessView>();

  protected readonly CipherType = CipherType;

  /** Tracks which hidden fields have been toggled visible, keyed by field index. */
  protected readonly visibleFields = signal<Record<number, boolean>>({});

  /** Current TOTP code (mock). */
  protected readonly totpCode = signal<string>("954 987");

  /** Seconds remaining until the next TOTP refresh. */
  protected readonly totpCountdown = signal<number>(30);

  private readonly totpIntervalId = signal<ReturnType<typeof setInterval> | null>(null);

  private readonly i18nService = inject(I18nService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly toastService = inject(ToastService);

  ngOnInit(): void {
    this.totpIntervalId.set(
      setInterval(() => {
        const next = this.totpCountdown() - 1;
        if (next <= 0) {
          this.totpCode.set(this.generateMockTotp());
          this.totpCountdown.set(30);
        } else {
          this.totpCountdown.set(next);
        }
      }, 1000),
    );
  }

  ngOnDestroy(): void {
    const intervalId = this.totpIntervalId();
    if (intervalId !== null) {
      clearInterval(intervalId);
    }
  }

  protected toggleVisibility(index: number): void {
    this.visibleFields.update((current) => ({
      ...current,
      [index]: !current[index],
    }));
  }

  protected copyField(field: ItemField): void {
    const value = field.totp ? this.totpCode() : field.value;
    this.platformUtilsService.copyToClipboard(value);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("valueCopied", field.label),
    });
  }

  protected isVisible(index: number, field: ItemField): boolean {
    if (!field.hidden) {
      return true;
    }
    return !!this.visibleFields()[index];
  }

  protected displayValue(index: number, field: ItemField): string {
    if (field.totp) {
      return this.totpCode();
    }
    if (field.hidden && !this.isVisible(index, field)) {
      return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
    }
    return field.value;
  }

  protected launchUrl(url: string): void {
    window.open(url, "_blank", "noreferrer,noopener");
  }

  protected cipherIcon(): string {
    const send = this.send();
    switch (send.item.cipherType) {
      case CipherType.Login:
        return "bwi-globe";
      case CipherType.Card:
        return "bwi-credit-card";
      case CipherType.Identity:
        return "bwi-id-card";
      case CipherType.SecureNote:
        return "bwi-sticky-note";
      default:
        return "bwi-globe";
    }
  }

  /** Generate a mock 6-digit TOTP code formatted as "XXX XXX". */
  private generateMockTotp(): string {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    return `${code.slice(0, 3)} ${code.slice(3)}`;
  }
}
