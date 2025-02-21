import { Component } from "@angular/core";

import { IconModule, TypographyModule } from "@bitwarden/components";

import { NoCredentialsIcon } from "./icons/no-credentials.icon";

@Component({
  standalone: true,
  selector: "bit-empty-credential-history",
  templateUrl: "empty-credential-history.component.html",
  imports: [IconModule, TypographyModule],
})
export class EmptyCredentialHistoryComponent {
  noCredentialsIcon = NoCredentialsIcon;

  constructor() {}
}
