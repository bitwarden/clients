import { Component } from "@angular/core";
import { Router } from "@angular/router";

import {
  Fido2UserInterfaceService as Fido2UserInterfaceServiceAbstraction
} from "@bitwarden/common/platform/abstractions/fido2/fido2-user-interface.service.abstraction";

import { DesktopFido2UserInterfaceService } from "../../autofill/services/desktop-fido2-user-interface.service";
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
        (click)="confirmPasskey()"
      >
        Confirm passkey
      </button>
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
    private readonly fido2UserInterfaceService: Fido2UserInterfaceServiceAbstraction<void>,
    private readonly router: Router,
  ) {}

  async confirmPasskey() {
    // placeholder, actual api arguments needed here should be discussed
    // just show casing we can call into the session to create the credential or change it.

    console.log("checking for session", this.fido2UserInterfaceService);

    const desktopService = this.fido2UserInterfaceService as DesktopFido2UserInterfaceService;

    const session = await desktopService.getCurrentSession();

    console.log("Got session", session);


    await session.createCredential({
      userHandle: "userHandle",
      userName: "",
      credentialName: "",
      rpId: "",
      userVerification: true,
    });

    console.log("Created credential, will notify complete");
    session.notifyOperationCompleted();

    await this.router.navigate(["/"]);
    await this.desktopSettingsService.setInModalMode(false);
  }

  async closeModal() {
    await this.router.navigate(["/"]);
    await this.desktopSettingsService.setInModalMode(false);
  }
}
