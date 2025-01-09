// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { AfterContentInit, Directive, HostListener, Input } from "@angular/core";

import { SsoComponent } from "@bitwarden/angular/auth/components/sso.component";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

@Directive({
  selector: "[app-link-sso]",
})
export class LinkSsoDirective extends SsoComponent implements AfterContentInit {
  @Input() organization: Organization;
  returnUri = "/settings/organizations";
  redirectUri = window.location.origin + "/sso-connector.html";
  clientId = "web";

  @HostListener("click", ["$event"])
  async onClick($event: MouseEvent) {
    $event.preventDefault();
    await this.submit(this.returnUri, true);
  }

  async ngAfterContentInit() {
    this.identifier = this.organization.identifier;
  }
}
