// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit, inject, DestroyRef } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup } from "@angular/forms";
import { firstValueFrom, map, Observable } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UpdateProfileRequest } from "@bitwarden/common/auth/models/request/update-profile.request";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ProfileResponse } from "@bitwarden/common/models/response/profile.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserPublicKey } from "@bitwarden/common/types/key";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { DynamicAvatarComponent } from "../../../components/dynamic-avatar.component";
import { AccountFingerprintComponent } from "../../../key-management/account-fingerprint/account-fingerprint.component";
import { SharedModule } from "../../../shared";

import { ChangeAvatarDialogComponent } from "./change-avatar-dialog.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-profile",
  templateUrl: "profile.component.html",
  imports: [SharedModule, DynamicAvatarComponent, AccountFingerprintComponent],
})
export class ProfileComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  loading = true;
  profile: ProfileResponse;
  fingerprintMaterial: string;
  userPublicKey: UserPublicKey;
  managingOrganization$: Observable<Organization>;
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
    private keyService: KeyService,
    private logService: LogService,
  ) {}

  async ngOnInit() {
    this.profile = await this.apiService.getProfile();
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.fingerprintMaterial = userId;
    const publicKey = (await firstValueFrom(
      this.keyService.userPublicKey$(userId),
    )) as UserPublicKey;
    if (publicKey == null) {
      this.logService.error(
        "[ProfileComponent] No public key available for the user: " +
          userId +
          " fingerprint can't be displayed.",
      );
    } else {
      this.userPublicKey = publicKey;
    }

    this.managingOrganization$ = this.organizationService
      .organizations$(userId)
      .pipe(
        map((organizations) => organizations.find((o) => o.userIsManagedByOrganization === true)),
      );

    this.formGroup.get("name").setValue(this.profile.name);
    this.formGroup.get("email").setValue(this.profile.email);

    this.formGroup
      .get("name")
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((name) => {
        this.profile.name = name;
      });

    this.loading = false;
  }

  openChangeAvatar = async () => {
    ChangeAvatarDialogComponent.open(this.dialogService, {
      data: { profile: this.profile },
    });
  };
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
