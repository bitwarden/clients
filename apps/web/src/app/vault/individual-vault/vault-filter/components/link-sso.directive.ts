import { Directive, HostListener, Input } from "@angular/core";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

import { LinkSsoService } from "../../../../auth/core/services/sso/link-sso.service";

@Directive({
  selector: "[app-link-sso]",
})
export class LinkSsoDirective {
  @Input() organization!: Organization;

  constructor(private linkSsoService: LinkSsoService) {}

  @HostListener("click", ["$event"])
  async onClick($event: MouseEvent) {
    $event.preventDefault();
    await this.linkSsoService.linkSso(this.organization);
  }
}
