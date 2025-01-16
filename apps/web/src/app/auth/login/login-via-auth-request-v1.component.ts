import { Component } from "@angular/core";

import { LoginViaAuthRequestComponentV1 as BaseLoginViaAuthRequestComponentV1 } from "@bitwarden/angular/auth/components/login-via-auth-request-v1.component";

@Component({
  selector: "app-login-via-auth-request",
  templateUrl: "login-via-auth-request-v1.component.html",
})
export class LoginViaAuthRequestComponentV1 extends BaseLoginViaAuthRequestComponentV1 {}
