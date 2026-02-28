import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import {
  BitSvg,
  TwoFactorAuthAuthenticatorIcon,
  TwoFactorAuthEmailIcon,
  TwoFactorAuthWebAuthnIcon,
} from "@bitwarden/assets/svg";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { SvgModule } from "@bitwarden/components";

/**
 * Displays an icon for a given two-factor authentication provider.
 *
 * Modern providers (Authenticator, Email, WebAuthn) render as inline SVGs via `bit-svg`.
 * Legacy providers (Duo, Yubikey, U2F, Remember, OrganizationDuo) render as CSS-classed
 * `<img>` elements that rely on provider-specific PNG assets loaded via stylesheet.
 *
 * @example
 * <auth-two-factor-icon [provider]="providerType" [name]="providerName" />
 */
@Component({
  selector: "auth-two-factor-icon",
  templateUrl: "./two-factor-icon.component.html",
  imports: [SvgModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TwoFactorIconComponent {
  /** The two-factor provider whose icon should be displayed. */
  readonly provider = input.required<TwoFactorProviderType>();

  /** Accessible alt text for the icon, typically the provider's display name. */
  readonly name = input<string>();

  /**
   * Returns `true` when the provider uses a legacy PNG asset rather than an SVG.
   * Legacy providers are rendered via a CSS class on an `<img>` element.
   */
  protected readonly isLegacyProvider = computed(() => {
    const p = this.provider();
    return (
      p === TwoFactorProviderType.Duo ||
      p === TwoFactorProviderType.Yubikey ||
      p === TwoFactorProviderType.U2f ||
      p === TwoFactorProviderType.Remember ||
      p === TwoFactorProviderType.OrganizationDuo
    );
  });

  /** Maps modern provider types to their corresponding SVG icon assets. */
  protected readonly IconProviderMap: Partial<Record<TwoFactorProviderType, BitSvg>> = {
    [TwoFactorProviderType.Authenticator]: TwoFactorAuthAuthenticatorIcon,
    [TwoFactorProviderType.Email]: TwoFactorAuthEmailIcon,
    [TwoFactorProviderType.WebAuthn]: TwoFactorAuthWebAuthnIcon,
  };
}
