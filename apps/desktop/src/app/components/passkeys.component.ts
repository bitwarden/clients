import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";

export type BrowserSyncVerificationDialogParams = {
  fingerprint: string[];
};

@Component({
  standalone: true,
  template: `
    <div
      style="background:white; display:flex; justify-content: center; align-items: center; flex-direction: column"
    >
      <img
        src="../resources/Frame2101.svg"
        class="mb-4 logo"
        alt="Bitwarden"
        width="440"
        height="400"
      />
      <br />
      <button bitButton type="button" buttonType="secondary" (click)="closeModal()">Close</button>
    </div>
  `,
  imports: [JslibModule],
})
export class PasskeysComponent {
  constructor(private readonly desktopSettingsService: DesktopSettingsService) {}

  async closeModal() {
    console.log("closing modal");
    await this.desktopSettingsService.setInModalMode(false);
  }
}
