import { CommonModule } from "@angular/common"; // Add this
import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { BehaviorSubject, Observable } from "rxjs";

import {
  DesktopFido2UserInterfaceService,
  DesktopFido2UserInterfaceSession,
} from "../../autofill/services/desktop-fido2-user-interface.service";
import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";

@Component({
  standalone: true,
  imports: [CommonModule], // Add this

  template: `
    <div
      style="background:white; display:flex; justify-content: center; align-items: center; flex-direction: column"
    >
      <h1 style="color: black">Select your passkey</h1>

      <div *ngFor="let item of cipherIds$ | async">
        <button
          style="color:black; padding: 10px 20px; border: 1px solid blue; margin: 10px"
          bitButton
          type="button"
          buttonType="secondary"
          (click)="chooseCipher(item)"
        >
          {{ item }}
        </button>
      </div>

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
export class Fido2PlaceholderComponent implements OnInit, OnDestroy {
  session?: DesktopFido2UserInterfaceSession = null;
  private cipherIdsSubject = new BehaviorSubject<string[]>([]);
  cipherIds$: Observable<string[]> = this.cipherIdsSubject.asObservable();

  constructor(
    private readonly desktopSettingsService: DesktopSettingsService,
    private readonly fido2UserInterfaceService: DesktopFido2UserInterfaceService,
    private readonly router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    this.session = this.fido2UserInterfaceService.getCurrentSession();

    const cipherIds = await this.session?.getAvailableCipherIds();
    this.cipherIdsSubject.next(cipherIds || []);

    // eslint-disable-next-line no-console
    console.log("Available cipher IDs", cipherIds);
  }

  async chooseCipher(cipherId: string) {
    this.session?.confirmChosenCipher(cipherId);

    await this.router.navigate(["/"]);
    await this.desktopSettingsService.setInModalMode(false);
  }

  ngOnDestroy() {
    this.cipherIdsSubject.complete(); // Clean up the BehaviorSubject
  }

  async confirmPasskey() {
    try {
      // Retrieve the current UI session to control the flow
      if (!this.session) {
        // todo: handle error
        throw new Error("No session found");
      }

      // If we want to we could submit information to the session in order to create the credential
      // const cipher = await session.createCredential({
      //   userHandle: "userHandle2",
      //   userName: "username2",
      //   credentialName: "zxsd2",
      //   rpId: "webauthn.io",
      //   userVerification: true,
      // });

      this.session.notifyConfirmNewCredential(true);

      // Not sure this clean up should happen here or in session.
      // The session currently toggles modal on and send us here
      // But if this route is somehow opened outside of session we want to make sure we clean up?
      await this.router.navigate(["/"]);
      await this.desktopSettingsService.setInModalMode(false);
    } catch (error) {
      // TODO: Handle error appropriately
    }
  }

  async closeModal() {
    await this.router.navigate(["/"]);
    await this.desktopSettingsService.setInModalMode(false);

    this.session.notifyConfirmNewCredential(false);
    // little bit hacky:
    this.session.confirmChosenCipher(null);
  }
}
