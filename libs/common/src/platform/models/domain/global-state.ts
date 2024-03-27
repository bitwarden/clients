import { ThemeType } from "../../enums";

export class GlobalState {
  installedVersion?: string;
  organizationInvitation?: any;
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
