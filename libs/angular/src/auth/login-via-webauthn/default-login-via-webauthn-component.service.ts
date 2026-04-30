import { LoginViaWebAuthnComponentService } from "./login-via-webauthn-component.service";

export class DefaultLoginViaWebAuthnComponentService implements LoginViaWebAuthnComponentService {
  showPageIcons = true;
  showTroubleLoggingInText = true;
  useDifferentLoginMethodLinkText = "useADifferentLogInMethod";
}
