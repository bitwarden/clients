import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NoCredentialsIcon } from "@bitwarden/assets/svg";
import { NoItemsModule } from "@bitwarden/components";

@Component({
  selector: "bit-empty-credential-history",
  templateUrl: "empty-credential-history.component.html",
  imports: [JslibModule, NoItemsModule],
})
export class EmptyCredentialHistoryComponent {
  noCredentialsIcon = NoCredentialsIcon;

  constructor() {}
}
