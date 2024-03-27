import { ThemeType } from "../../enums";

export class GlobalState {
  installedVersion?: string;
  organizationInvitation?: any;
  rememberedEmail?: string;
  theme?: ThemeType = ThemeType.System;
  twoFactorToken?: string;
  biometricFingerprintValidated?: boolean;
  vaultTimeout?: number;
  vaultTimeoutAction?: string;
  loginRedirect?: any;
  mainWindowSize?: number;
  enableBrowserIntegration?: boolean;
  enableBrowserIntegrationFingerprint?: boolean;
  deepLinkRedirectUrl?: string;
}
