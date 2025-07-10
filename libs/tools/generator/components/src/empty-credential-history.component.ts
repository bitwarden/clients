import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { IconModule, TypographyModule } from "@bitwarden/components";

import { NoCredentialsIcon } from "./icons/no-credentials.icon";

@Component({
  selector: "bit-empty-credential-history",
  templateUrl: "empty-credential-history.component.html",
  imports: [JslibModule, IconModule, TypographyModule],
})
export class EmptyCredentialHistoryComponent {
  noCredentialsIcon = NoCredentialsIcon;

  constructor() {}
}
