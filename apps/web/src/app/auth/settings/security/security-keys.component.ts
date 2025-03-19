// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit, ViewChild, ViewContainerRef } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { DialogService } from "@bitwarden/components";

import { ApiKeyComponent } from "./api-key.component";

@Component({
  selector: "app-security-keys",
  templateUrl: "security-keys.component.html",
})
export class SecurityKeysComponent implements OnInit {
  @ViewChild("viewUserApiKeyTemplate", { read: ViewContainerRef, static: true })
  viewUserApiKeyModalRef: ViewContainerRef;
  @ViewChild("rotateUserApiKeyTemplate", { read: ViewContainerRef, static: true })
  rotateUserApiKeyModalRef: ViewContainerRef;

  showChangeKdf = true;

  constructor(
    private userVerificationService: UserVerificationService,
    private accountService: AccountService,
    private apiService: ApiService,
    private dialogService: DialogService,
  ) {}

  async ngOnInit() {
    this.showChangeKdf = await this.userVerificationService.hasMasterPassword();
  }

  async viewUserApiKey() {
    const entityId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );
    await ApiKeyComponent.open(this.dialogService, {
      data: {
        keyType: "user",
        entityId: entityId,
        postKey: this.apiService.postUserApiKey.bind(this.apiService),
        scope: "api",
        grantType: "client_credentials",
        apiKeyTitle: "apiKey",
        apiKeyWarning: "userApiKeyWarning",
        apiKeyDescription: "userApiKeyDesc",
      },
    });
  }

  async rotateUserApiKey() {
    const entityId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );
    await ApiKeyComponent.open(this.dialogService, {
      data: {
        keyType: "user",
        isRotation: true,
        entityId: entityId,
        postKey: this.apiService.postUserRotateApiKey.bind(this.apiService),
        scope: "api",
        grantType: "client_credentials",
        apiKeyTitle: "apiKey",
        apiKeyWarning: "userApiKeyWarning",
        apiKeyDescription: "apiKeyRotateDesc",
      },
    });
  }
}
