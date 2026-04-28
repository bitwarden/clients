import { LoginViaWebAuthnComponentService } from "./login-via-webauthn-component.service";

export class DefaultLoginViaWebAuthnComponentService implements LoginViaWebAuthnComponentService {
  shouldShowPageIcon = true;
  shouldShowTroubleLoggingInText = true;
  useDifferentLoginMethodLinkText = { key: "useADifferentLogInMethod" };
}
