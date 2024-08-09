import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { UpdateProfileRequest } from "@bitwarden/common/auth/models/request/update-profile.request";
import { ProfileResponse } from "@bitwarden/common/models/response/profile.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { DialogService } from "@bitwarden/components";

import { ChangeAvatarDialogComponent } from "./change-avatar-dialog.component";

@Component({
  selector: "app-profile",
  templateUrl: "profile.component.html",
})
export class ProfileComponent implements OnInit, OnDestroy {
  loading = true;
  profile: ProfileResponse;
  fingerprintMaterial: string;
  private destroy$ = new Subject<void>();

  protected formGroup = new FormGroup({
    name: new FormControl(null),
    email: new FormControl(null),
  });

  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private stateService: StateService,
    private dialogService: DialogService,
  ) {}

  async ngOnInit() {
    this.profile = await this.apiService.getProfile();
    this.loading = false;
    this.fingerprintMaterial = await this.stateService.getUserId();
    this.formGroup.get("name").setValue(this.profile.name);
    this.formGroup.get("email").setValue(this.profile.email);

    this.formGroup
      .get("name")
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((name) => {
        this.profile.name = name;
      });
  }

  openChangeAvatar = async () => {
    ChangeAvatarDialogComponent.open(this.dialogService, {
      data: { profile: this.profile },
    });
  };

  async ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit = async () => {
    const request = new UpdateProfileRequest(
      this.formGroup.get("name").value,
      this.profile.masterPasswordHint,
    );
    await this.apiService.putProfile(request);
    this.platformUtilsService.showToast("success", null, this.i18nService.t("accountUpdated"));
  };
}
