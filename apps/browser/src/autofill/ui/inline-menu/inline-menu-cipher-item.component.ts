import { ChangeDetectionStrategy, Component, computed, inject, input, output } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { IconButtonModule, IconComponent, ItemModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { InlineMenuCipherData } from "../../background/abstractions/overlay.background";
import { CipherIconComponent } from "../shared/cipher-icon.component";

import { TotpCountdownComponent } from "./totp-countdown.component";

@Component({
  selector: "autofill-inline-menu-cipher-item",
  imports: [
    CipherIconComponent,
    I18nPipe,
    IconButtonModule,
    IconComponent,
    ItemModule,
    TotpCountdownComponent,
  ],
  template: `
    <bit-item>
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
        {{ totp() ? ("fillVerificationCode" | i18n) : cipher().name }}
        @if (totp(); as totp) {
          <span slot="secondary" class="tw-flex tw-flex-col">
            @if (showTotpUsername() && cipher().login?.username) {
              <span>{{ cipher().login?.username }}</span>
            }
            <span
              data-testid="totp-code"
              [class.tw-tracking-widest]="masked()"
              [attr.aria-label]="'totpCodeAria' | i18n"
              >{{ totp }}</span
            >
          </span>
        } @else if (passkey(); as passkey) {
          <span slot="secondary" class="tw-flex tw-flex-col">
            @if (passkey.firstLine) {
              <span class="tw-flex tw-items-center tw-gap-1">
                <bit-icon name="bwi-passkey" />
                {{ passkey.firstLine }}
              </span>
            }
            @if (passkey.secondLine) {
              <span>{{ passkey.secondLine }}</span>
            }
          </span>
        } @else if (subtitle()) {
          <span slot="secondary">{{ subtitle() }}</span>
        }
      </button>
      <bit-item-action slot="end">
        <button
          id="inline-menu-cipher-item_button_view"
          type="button"
          bitIconButton="bwi-external-link"
          buttonType="subtleGhost"
          size="small"
          [label]="viewLabel()"
          (click)="view.emit()"
        ></button>
      </bit-item-action>
    </bit-item>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineMenuCipherItemComponent {
  private readonly i18nService = inject(I18nService);

  readonly cipher = input.required<InlineMenuCipherData>();
  /** Show the username under the TOTP code, used when several TOTP items are listed. */
  readonly showTotpUsername = input(false);
  /** Freezes the TOTP countdown, for stories and screenshots. */
  readonly totpSecondsRemaining = input<number>();

  readonly fill = output<void>();
  readonly view = output<void>();
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

  protected readonly passkey = computed(() => {
    const cipher = this.cipher();
    const passkey = cipher.login?.passkey;
    if (!passkey) {
      return undefined;
    }
    const showRpName = cipher.name !== passkey.rpName;
    const secondary = cipher.login?.username || passkey.userName;
    return {
      firstLine: showRpName ? passkey.rpName : secondary,
      secondLine: showRpName ? secondary : undefined,
    };
  });

  protected readonly subtitle = computed(() => {
    const cipher = this.cipher();
    return (
      cipher.identity?.username ||
      cipher.identity?.fullName ||
      cipher.login?.username ||
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

  protected readonly viewLabel = computed(
    () =>
      `${this.i18nService.t("view")} ${this.cipher().name}, ${this.i18nService.t("opensInANewWindow")}`,
  );
}
