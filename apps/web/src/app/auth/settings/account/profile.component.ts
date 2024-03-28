import { Component, OnInit } from "@angular/core";
import { lastValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { UpdateProfileRequest } from "@bitwarden/common/auth/models/request/update-profile.request";
import { ProfileResponse } from "@bitwarden/common/models/response/profile.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { DialogService } from "@bitwarden/components";

import { ChangeAvatarComponent } from "./change-avatar.component";

@Component({
  selector: "app-profile",
  templateUrl: "profile.component.html",
})
export class ProfileComponent implements OnInit {
  loading = true;
  profile: ProfileResponse;
  fingerprintMaterial: string;

  formPromise: Promise<any>;

  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private logService: LogService,
    private stateService: StateService,
    private dialogService: DialogService,
  ) {}

  async ngOnInit() {
    this.profile = await this.apiService.getProfile();
    this.loading = false;
    this.fingerprintMaterial = await this.stateService.getUserId();
  }

  async openChangeAvatar() {
    const dialogRef = ChangeAvatarComponent.openChangeAvatarDialog(this.dialogService, {
      data: { profile: this.profile },
    });
    const result = await lastValueFrom(dialogRef.closed);
    return result;
  }

  async submit() {
    try {
      const request = new UpdateProfileRequest(this.profile.name, this.profile.masterPasswordHint);
      this.formPromise = this.apiService.putProfile(request);
      await this.formPromise;
      this.platformUtilsService.showToast("success", null, this.i18nService.t("accountUpdated"));
    } catch (e) {
      this.logService.error(e);
    }
  }
}
