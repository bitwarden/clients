import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";

export type BrowserSyncVerificationDialogParams = {
  fingerprint: string[];
};

@Component({
  standalone: true,
  template: `
    <div style="background:white; display:flex; justify-content: center; align-items: center;">
      <img
        src="../resources/Frame2101.svg"
        class="mb-4 logo"
        alt="Bitwarden"
        width="440"
        height="400"
      />
    </div>
  `,
  imports: [JslibModule],
})
export class PasskeysComponent {}
