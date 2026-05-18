import { LoginViaWebAuthnComponentService } from "./login-via-webauthn-component.service";

export class DefaultLoginViaWebAuthnComponentService implements LoginViaWebAuthnComponentService {
  successRoute = "/vault";
}
