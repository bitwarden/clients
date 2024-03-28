import { ViewChild, ViewContainerRef, Component, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";

import { ModalService } from "@bitwarden/angular/services/modal.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { UpdateProfileRequest } from "@bitwarden/common/auth/models/request/update-profile.request";
import { ProfileResponse } from "@bitwarden/common/models/response/profile.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";

import { ChangeAvatarComponent } from "./change-avatar.component";

@Component({
  selector: "app-profile",
  templateUrl: "profile.component.html",
})
export class ProfileComponent implements OnInit, OnDestroy {
  loading = true;
  profile: ProfileResponse;
  fingerprintMaterial: string;

  @ViewChild("avatarModalTemplate", { read: ViewContainerRef, static: true })
  avatarModalRef: ViewContainerRef;
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
    private modalService: ModalService,
  ) {}

  async ngOnInit() {
    this.profile = await this.apiService.getProfile();
    this.loading = false;
    this.fingerprintMaterial = await this.stateService.getUserId();
    this.name = this.profile.name;
    this.email = this.profile.email;

    this.formGroup
      .get("name")
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((name) => {
        this.profile.name = name;
      });
  }

  async ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get name(): string {
    return this.formGroup.value.name;
  }

  set name(profileName: string) {
    this.formGroup.get("name").setValue(profileName);
  }

  get email(): string {
    return this.formGroup.value.email;
  }

  set email(profileEmail: string) {
    this.formGroup.get("email").setValue(profileEmail);
  }

  openChangeAvatar = async () => {
    const modalOpened = await this.modalService.openViewRef(
      ChangeAvatarComponent,
      this.avatarModalRef,
      (modal) => {
        modal.profile = this.profile;
        modal.changeColor.pipe(takeUntil(this.destroy$)).subscribe(() => {
          modalOpened[0].close();
        });
      },
    );
  };

  submit = async () => {
    const request = new UpdateProfileRequest(this.name, this.profile.masterPasswordHint);
    await this.apiService.putProfile(request);
    this.platformUtilsService.showToast("success", null, this.i18nService.t("accountUpdated"));
  };
}
