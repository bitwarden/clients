import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";

@Component({
  standalone: true,
  template: `
    <div
      style="background:white; display:flex; justify-content: center; align-items: center; flex-direction: column"
    >
      <h1 style="color: black">Select your passkey</h1>
      <br />
      <button
        style="color:black; padding: 10px 20px; border: 1px solid black; margin: 10px"
        bitButton
        type="button"
        buttonType="secondary"
        (click)="closeModal()"
      >
        Close
      </button>
    </div>
  `,
})
export class Fido2PlaceholderComponent {
  constructor(
    private readonly desktopSettingsService: DesktopSettingsService,
    private readonly router: Router,
  ) {}

  async closeModal() {
    await this.router.navigate(["/"]);
    await this.desktopSettingsService.setInModalMode(false);
  }
}
