import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import {
  BitSvg,
  TwoFactorAuthAuthenticatorIcon,
  TwoFactorAuthDuoIcon,
  TwoFactorAuthEmailIcon,
  TwoFactorAuthWebAuthnIcon,
  TwoFactorAuthYubicoIcon,
} from "@bitwarden/assets/svg";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { SvgModule } from "@bitwarden/components";

/**
 * Displays an icon for a given two-factor authentication provider.
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

  /** Maps provider types to their corresponding SVG icon assets. */
  protected readonly IconProviderMap: Partial<Record<TwoFactorProviderType, BitSvg>> = {
    [TwoFactorProviderType.Authenticator]: TwoFactorAuthAuthenticatorIcon,
    [TwoFactorProviderType.Duo]: TwoFactorAuthDuoIcon,
    [TwoFactorProviderType.Email]: TwoFactorAuthEmailIcon,
    [TwoFactorProviderType.OrganizationDuo]: TwoFactorAuthDuoIcon,
    [TwoFactorProviderType.WebAuthn]: TwoFactorAuthWebAuthnIcon,
    [TwoFactorProviderType.Yubikey]: TwoFactorAuthYubicoIcon,
  };
}
