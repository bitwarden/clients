import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";

export type BrowserSyncVerificationDialogParams = {
  fingerprint: string[];
};

@Component({
  standalone: true,
  template: `
    <img
      src="../resources/passkeys.png"
      class="mb-4 logo"
      alt="Bitwarden"
      width="660"
      height="580"
    />
  `,
  imports: [JslibModule],
})
export class PasskeysComponent {}
