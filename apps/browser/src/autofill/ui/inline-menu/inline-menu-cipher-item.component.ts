import { ChangeDetectionStrategy, Component, computed, inject, input, output } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { IconComponent, ItemModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { InlineMenuCipherData } from "../../background/abstractions/overlay.background";
import { CipherIconComponent } from "../shared/cipher-icon.component";

import { TotpCountdownComponent } from "./totp-countdown.component";

/**
 * The main content of a cipher row: the fill button. The list renders the surrounding `bit-item`
 * so compact mode can join neighboring rows, and puts the "view" action in the item end slot.
 */
@Component({
  selector: "autofill-inline-menu-cipher-item",
  imports: [CipherIconComponent, I18nPipe, IconComponent, ItemModule, TotpCountdownComponent],
  host: { class: "tw-flex tw-min-w-0 tw-flex-1" },
  template: `
    <button
      id="inline-menu-cipher-item_button_fill"
      type="button"
      bit-item-content
      [title]="fillLabel()"
      [attr.aria-label]="fillLabel()"
      [attr.aria-description]="fillDescription()"
      (click)="fill.emit()"
    >
      @if (totp()) {
        <autofill-totp-countdown
          slot="start"
          [period]="cipher().login?.totpCodeTimeInterval ?? 30"
          [secondsRemaining]="totpSecondsRemaining()"
          (periodElapsed)="totpPeriodElapsed.emit()"
        />
      } @else {
        <autofill-cipher-icon slot="start" [uri]="iconUri()" />
      }
      {{ title() }}
      @if (cipher().login?.passkey) {
        <bit-icon slot="default-trailing" name="bwi-passkey" class="tw-text-fg-body-subtle" />
      }
      @if (totp(); as totp) {
        <span
          slot="secondary"
          data-testid="totp-code"
          [class.tw-tracking-widest]="masked()"
          [attr.aria-label]="'totpCodeAria' | i18n"
          >{{ totp }}</span
        >
      } @else if (subtitle()) {
        <span slot="secondary">{{ subtitle() }}</span>
      }
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineMenuCipherItemComponent {
  private readonly i18nService = inject(I18nService);

  readonly cipher = input.required<InlineMenuCipherData>();
  /** Freezes the TOTP countdown, for stories and screenshots. */
  readonly totpSecondsRemaining = input<number>();

  readonly fill = output<void>();
  readonly totpPeriodElapsed = output<void>();

  protected readonly iconUri = computed(() => {
    const { imageEnabled, image } = this.cipher().icon;
    return (imageEnabled && image) || undefined;
  });

  protected readonly masked = computed(() => !!this.cipher().reprompt);

  /** The formatted code, or undefined when this is not a TOTP fill item. */
  protected readonly totp = computed(() => {
    const login = this.cipher().login;
    if (!login?.totpField || !login.totp) {
      return undefined;
    }
    return this.masked() ? "●●●●●●" : `${login.totp.substring(0, 3)} ${login.totp.substring(3)}`;
  });

  /** TOTP rows lead with the account the code belongs to. */
  protected readonly title = computed(() => {
    const cipher = this.cipher();
    return this.totp() ? cipher.login?.username || cipher.name : cipher.name;
  });

  protected readonly subtitle = computed(() => {
    const cipher = this.cipher();
    return (
      cipher.identity?.username ||
      cipher.identity?.fullName ||
      cipher.login?.username ||
      cipher.login?.passkey?.userName ||
      cipher.card ||
      ""
    );
  });

  protected readonly fillLabel = computed(() => {
    const prefix = this.cipher().login?.passkey
      ? this.i18nService.t("logInWithPasskeyAriaLabel")
      : this.i18nService.t("fillCredentialsFor");
    return `${prefix} ${this.cipher().name}`;
  });

  protected readonly fillDescription = computed(() => {
    const cipher = this.cipher();
    if (cipher.login) {
      const username = cipher.login.username || cipher.login.passkey?.userName;
      return username ? `${this.i18nService.t("username").toLowerCase()}: ${username}` : undefined;
    }
    if (!cipher.card) {
      return undefined;
    }
    const endsWith = this.i18nService.t("cardNumberEndsWith");
    const [brand, digits] = cipher.card.split(", *");
    if (digits === undefined) {
      return `${endsWith} ${brand.replace(/^\*/, "")}`;
    }
    return `${brand}, ${endsWith} ${digits}`;
  });
}
