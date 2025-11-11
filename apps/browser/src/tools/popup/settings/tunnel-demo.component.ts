import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  ButtonModule,
  CardComponent,
  DialogService,
  FormFieldModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

import { TunnelService } from "./tunnel.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  standalone: true,
  selector: "tunnel-demo",
  templateUrl: "tunnel-demo.component.html",
  imports: [
    CommonModule,
    PopOutComponent,
    PopupHeaderComponent,
    PopupPageComponent,
    CardComponent,
    SectionComponent,
    SectionHeaderComponent,
    FormFieldModule,
    ButtonModule,
    ReactiveFormsModule,
    TypographyModule,
    JslibModule,
  ],
})
export class TunnelDemoComponent {
  protected formGroup = this.formBuilder.group({
    vaultItemName: ["", Validators.required],
  });

  constructor(
    private dialogService: DialogService,
    private cipherService: CipherService,
    private accountService: AccountService,
    private formBuilder: FormBuilder,
    private tunnelService: TunnelService,
  ) {}

  async submit() {
    if (this.formGroup.invalid) {
      return;
    }

    const vaultItemName = this.formGroup.value.vaultItemName?.trim();

    if (!vaultItemName) {
      await this.dialogService.openSimpleDialog({
        title: "Tunnel Demo",
        content: "No vault item name provided.",
        type: "warning",
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
      });
      return;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const allCiphers = await this.cipherService.getAllDecrypted(userId);

    // Find the cipher with the user-provided name
    const tunnelDemoCipher = allCiphers.find(
      (cipher: CipherView) => cipher.name === vaultItemName && cipher.type === CipherType.Login,
    );

    if (!tunnelDemoCipher || !tunnelDemoCipher.login) {
      await this.dialogService.openSimpleDialog({
        title: "Tunnel Demo",
        content: `No vault entry found with the name "${vaultItemName}". Please create one with a username and password.`,
        type: "warning",
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
      });
      return;
    }

    const username = tunnelDemoCipher.login.username || "(none)";
    const password = tunnelDemoCipher.login.password || "(none)";

    // Send credentials to the localhost tunnel server
    try {
      await this.tunnelService.sendCredentials({ username, password });

      await this.dialogService.openSimpleDialog({
        title: "Tunnel Demo - Success",
        content: `Credentials successfully sent to tunnel server.\n\nUsername:
          ${username}\nPassword: ${password.replace(/./g, "*")}`,
        type: "success",
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
      });
    } catch (error) {
      await this.dialogService.openSimpleDialog({
        title: "Tunnel Demo - Error",
        content: `Failed to send credentials to tunnel server: ${error.message || error}`,
        type: "danger",
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
      });
    }
  }
}
