import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { Fido2UserInterfaceService as Fido2UserInterfaceServiceAbstraction } from "@bitwarden/common/platform/abstractions/fido2/fido2-user-interface.service.abstraction";

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
    const desktopUiService = this.fido2UserInterfaceService as DesktopFido2UserInterfaceService;
    console.log("Got desktopService", desktopUiService.guid);

    try {
      console.log("checking for session", this.fido2UserInterfaceService);
      // Add timeout to avoid infinite hanging
      const session = desktopUiService.getCurrentSession();
      if (!session) {
        // todo: handle error
        console.error("No session found");
        return;
      }
      console.log("Got session", session.guid);

      // const cipher = await session.createCredential({
      //   userHandle: "userHandle2",
      //   userName: "username2",
      //   credentialName: "zxsd2",
      //   rpId: "webauthn.io",
      //   userVerification: true,
      // });

      session.notifyOperationCompleted();
      await this.router.navigate(["/"]);
      await this.desktopSettingsService.setInModalMode(false);
    } catch (error) {
      console.error("Failed during confirmation:", error);
      // Handle error appropriately
    }
  }

  async closeModal() {
    await this.router.navigate(["/"]);
    await this.desktopSettingsService.setInModalMode(false);
  }
}
