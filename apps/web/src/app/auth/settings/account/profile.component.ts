import { ChangeDetectionStrategy, Component, computed, OnInit, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup } from "@angular/forms";
import { firstValueFrom, map, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
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

@Component({
  selector: "app-profile",
  templateUrl: "profile.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SharedModule, DynamicAvatarComponent, AccountFingerprintComponent],
})
export class ProfileComponent implements OnInit {
  protected readonly loading = signal(true);
  protected readonly profile = signal<ProfileResponse | undefined>(undefined);
  protected readonly fingerprintMaterial = signal<string | undefined>(undefined);
  protected readonly userPublicKey = signal(undefined as UserPublicKey | undefined);

  protected readonly formGroup = new FormGroup({
    name: new FormControl("", { nonNullable: true }),
  });

  protected readonly email = toSignal(
    this.accountService.activeAccount$.pipe(map((account) => account?.email ?? "")),
  );

  // Live value of the name field so the avatar initials update as the user types.
  private readonly enteredName = toSignal(this.formGroup.controls.name.valueChanges, {
    initialValue: "",
  });

  protected readonly avatarUser = computed(() => ({
    name: this.enteredName(),
    email: this.email(),
  }));

  protected readonly managingOrganization = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.organizationService.organizations$(userId)),
      map((organizations) => organizations.find((o) => o.userIsClaimedByOrganization === true)),
    ),
  );

  constructor(
    private readonly apiService: ApiService,
    private readonly i18nService: I18nService,
    private readonly accountService: AccountService,
    private readonly dialogService: DialogService,
    private readonly toastService: ToastService,
    private readonly organizationService: OrganizationService,
    private readonly keyService: KeyService,
    private readonly logService: LogService,
  ) {}

  async ngOnInit() {
    const profile = await this.apiService.getProfile();
    this.profile.set(profile);

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.fingerprintMaterial.set(userId);

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
      this.userPublicKey.set(publicKey);
    }

    this.formGroup.controls.name.setValue(profile.name);

    this.loading.set(false);
  }

  protected readonly openChangeAvatar = async () => {
    const profile = this.profile();
    if (profile == null) {
      return;
    }

    ChangeAvatarDialogComponent.open(this.dialogService, {
      data: { profile },
    });
  };

  protected readonly submit = async () => {
    const request = new UpdateProfileRequest(this.formGroup.controls.name.value);
    await this.apiService.putProfile(request);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("accountUpdated"),
    });
  };
}
