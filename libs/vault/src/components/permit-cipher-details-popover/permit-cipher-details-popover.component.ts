import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LinkModule, PopoverModule } from "@bitwarden/components";

@Component({
  selector: "vault-permit-cipher-details-popover",
  templateUrl: "./permit-cipher-details-popover.component.html",
  imports: [PopoverModule, JslibModule, LinkModule],
})
export class PermitCipherDetailsPopoverComponent {}
