// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { firstValueFrom, map, Observable, Subject, takeUntil } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UpdateProfileRequest } from "@bitwarden/common/auth/models/request/update-profile.request";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ProfileResponse } from "@bitwarden/common/models/response/profile.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { DynamicAvatarComponent } from "../../../components/dynamic-avatar.component";
import { SharedModule } from "../../../shared";
import { AccountFingerprintComponent } from "../../../shared/components/account-fingerprint/account-fingerprint.component";

import { ChangeAvatarDialogComponent } from "./change-avatar-dialog.component";

@Component({
  selector: "app-profile",
  templateUrl: "profile.component.html",
  imports: [SharedModule, DynamicAvatarComponent, AccountFingerprintComponent],
})
export class ProfileComponent implements OnInit, OnDestroy {
  loading = true;
  profile: ProfileResponse;
  fingerprintMaterial: string;
  managingOrganization$: Observable<Organization>;
  private destroy$ = new Subject<void>();

  protected formGroup = new FormGroup({
    name: new FormControl(null),
    email: new FormControl(null),
  });

  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private accountService: AccountService,
    private dialogService: DialogService,
    private toastService: ToastService,
    private organizationService: OrganizationService,
  ) {}

  async ngOnInit() {
    this.profile = await this.apiService.getProfile();
    this.loading = false;
    this.fingerprintMaterial = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    this.managingOrganization$ = this.organizationService
      .organizations$(userId)
      .pipe(
        map((organizations) => organizations.find((o) => o.userIsManagedByOrganization === true)),
      );

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
    const request = new UpdateProfileRequest(this.formGroup.get("name").value);
    await this.apiService.putProfile(request);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("accountUpdated"),
    });
  };
}
