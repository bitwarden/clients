import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { svg } from "@bitwarden/assets/svg";
import { SvgModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

// The button sits on arbitrary third-party pages, so the brand mark uses tokens that do not
// change between themes.
const Logo = svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" fill="none"><path class="tw-fill-bw-blue" d="M12.66.175A.566.566 0 0 0 12.25 0H1.75a.559.559 0 0 0-.409.175.561.561 0 0 0-.175.41v7c.002.532.105 1.06.305 1.554.189.488.444.948.756 1.368.322.42.682.81 1.076 1.163.365.335.75.649 1.152.939.35.248.718.483 1.103.706.385.222.656.372.815.45.16.08.29.141.386.182A.53.53 0 0 0 7 14a.509.509 0 0 0 .238-.055c.098-.043.225-.104.387-.182.162-.079.438-.23.816-.45.378-.222.75-.459 1.102-.707.403-.29.788-.604 1.154-.939a8.435 8.435 0 0 0 1.076-1.163c.312-.42.567-.88.757-1.367a4.19 4.19 0 0 0 .304-1.555v-7a.55.55 0 0 0-.174-.407Z"/><path class="tw-fill-bg-white" d="M7 12.365s4.306-2.18 4.306-4.717V1.5H7v10.865Z"/></svg>`;

const LockedLogo = svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><g clip-path="url(#inline-menu-button-locked-clip)"><path class="tw-fill-bw-blue" d="M12.66.175A.566.566 0 0 0 12.25 0H1.75a.559.559 0 0 0-.409.175.561.561 0 0 0-.175.41v7c.002.532.105 1.06.305 1.554.189.488.444.948.756 1.368.322.42.682.81 1.076 1.163.365.335.75.649 1.152.939.35.248.718.483 1.103.706.385.222.656.372.815.45.16.08.29.141.386.182A.53.53 0 0 0 7 14a.509.509 0 0 0 .238-.055c.098-.043.225-.104.387-.182.162-.079.438-.23.816-.45.378-.222.75-.459 1.102-.707.403-.29.788-.604 1.154-.939a8.435 8.435 0 0 0 1.076-1.163c.312-.42.567-.88.757-1.367a4.19 4.19 0 0 0 .304-1.555v-7a.55.55 0 0 0-.174-.407Z"/><path class="tw-fill-bg-white" d="M7 12.365s4.306-2.18 4.306-4.717V1.5H7v10.865Z"/><circle cx="12.889" cy="12.889" r="4.889" class="tw-fill-bg-white"/><path class="tw-fill-fg-dark" d="M11.26 11.717h2.37v-.848c0-.313-.116-.58-.348-.8a1.17 1.17 0 0 0-.838-.332c-.327 0-.606.11-.838.332a1.066 1.066 0 0 0-.347.8v.848Zm3.851.424v2.546a.4.4 0 0 1-.13.3.44.44 0 0 1-.314.124h-4.445a.44.44 0 0 1-.315-.124.4.4 0 0 1-.13-.3V12.14a.4.4 0 0 1 .13-.3.44.44 0 0 1 .315-.124h.148v-.848c0-.542.204-1.008.612-1.397a2.044 2.044 0 0 1 1.462-.583c.568 0 1.056.194 1.463.583.408.39.611.855.611 1.397v.848h.149a.44.44 0 0 1 .315.124.4.4 0 0 1 .13.3Z"/></g><defs><clipPath id="inline-menu-button-locked-clip"><rect width="16" height="16" rx="2"/></clipPath></defs></svg>`;

/** The Bitwarden icon shown inside a focused form field. */
@Component({
  selector: "autofill-inline-menu-button",
  imports: [I18nPipe, SvgModule],
  template: `
    <button
      id="inline-menu-button_button_toggle"
      type="button"
      tabindex="-1"
      class="tw-block tw-w-full tw-cursor-pointer tw-border-none tw-bg-transparent tw-p-0"
      [attr.aria-label]="'toggleBitwardenVaultOverlay' | i18n"
      (click)="toggle.emit()"
    >
      <bit-svg [content]="unlocked() ? Logo : LockedLogo" class="tw-block tw-w-full" />
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineMenuButtonComponent {
  protected readonly Logo = Logo;
  protected readonly LockedLogo = LockedLogo;

  /** Shows the plain logo when true, the logo with a lock badge otherwise. */
  readonly unlocked = input(false);

  readonly toggle = output<void>();
}
