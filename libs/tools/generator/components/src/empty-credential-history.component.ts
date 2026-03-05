import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NoCredentialsIcon } from "@bitwarden/assets/svg";
import { NoItemsModule } from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-empty-credential-history",
  templateUrl: "empty-credential-history.component.html",
  imports: [JslibModule, NoItemsModule],
})
export class EmptyCredentialHistoryComponent {
  noCredentialsIcon = NoCredentialsIcon;

  constructor() {}
}
