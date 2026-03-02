import { Component, OnInit } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { DialogService } from "@bitwarden/components";

import { ChangeKdfModule } from "../../../key-management/change-kdf/change-kdf.module";
import { SharedModule } from "../../../shared";

import { ApiKeyComponent } from "./api-key.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "security-keys.component.html",
  imports: [SharedModule, ChangeKdfModule],
})
export class SecurityKeysComponent implements OnInit {
  showChangeKdf = true;

  constructor(
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private accountService: AccountService,
    private apiService: ApiService,
    private dialogService: DialogService,
  ) {}

  async ngOnInit() {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    this.showChangeKdf = await firstValueFrom(
      this.userDecryptionOptionsService.hasMasterPasswordById$(userId),
    );
  }

  async viewUserApiKey() {
    const entityId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );

    if (!entityId) {
      throw new Error("Active account not found");
    }

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

    if (!entityId) {
      throw new Error("Active account not found");
    }

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
