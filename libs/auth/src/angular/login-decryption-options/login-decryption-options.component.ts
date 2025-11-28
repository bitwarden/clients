// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, DestroyRef, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, FormControl, ReactiveFormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { catchError, defer, firstValueFrom, from, map, of, switchMap, throwError } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  LoginEmailServiceAbstraction,
  LogoutService,
  UserDecryptionOptions,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PasswordResetEnrollmentServiceAbstraction } from "@bitwarden/common/auth/abstractions/password-reset-enrollment.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { ClientType } from "@bitwarden/common/enums";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { UserId } from "@bitwarden/common/types/guid";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  AnonLayoutWrapperDataService,
  AsyncActionsModule,
  ButtonModule,
  CheckboxModule,
  DialogService,
  FormFieldModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { LoginDecryptionOptionsService } from "./login-decryption-options.service";

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
enum State {
  NewUser,
  ExistingUserUntrustedDevice,
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./login-decryption-options.component.html",
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CheckboxModule,
    CommonModule,
    FormFieldModule,
    JslibModule,
    ReactiveFormsModule,
    TypographyModule,
  ],
})
export class LoginDecryptionOptionsComponent implements OnInit {
  private activeAccountId: UserId;
  private clientType: ClientType;
  private email: string;

  protected loading = false;
  protected state: State;
  protected State = State;

  protected formGroup = this.formBuilder.group({
    rememberDevice: [true], // Remember device means for the user to trust the device
  });

  private get rememberDeviceControl(): FormControl<boolean> {
    return this.formGroup.controls.rememberDevice;
  }

  // New User Properties
  private newUserOrgId: string;

  // Existing User Untrusted Device Properties
  protected canApproveFromOtherDevice = false;
  protected canRequestAdminApproval = false;
  protected canApproveWithMasterPassword = false;

  constructor(
    private accountService: AccountService,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
    private apiService: ApiService,
    private destroyRef: DestroyRef,
    private deviceTrustService: DeviceTrustServiceAbstraction,
    private dialogService: DialogService,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private keyService: KeyService,
    private loginDecryptionOptionsService: LoginDecryptionOptionsService,
    private loginEmailService: LoginEmailServiceAbstraction,
    private messagingService: MessagingService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private passwordResetEnrollmentService: PasswordResetEnrollmentServiceAbstraction,
    private platformUtilsService: PlatformUtilsService,
    private router: Router,
    private ssoLoginService: SsoLoginServiceAbstraction,
    private toastService: ToastService,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private validationService: ValidationService,
    private logoutService: LogoutService,
  ) {
    this.clientType = this.platformUtilsService.getClientType();
  }

  async ngOnInit() {
    this.loading = true;

    this.activeAccountId = (await firstValueFrom(this.accountService.activeAccount$))?.id;

    this.email = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.email)),
    );

    if (!this.email) {
      await this.handleMissingEmail();
      return;
    }

    this.observeAndPersistRememberDeviceValueChanges();
    await this.setRememberDeviceDefaultValueFromState();

    try {
      const userDecryptionOptions = await firstValueFrom(
        this.userDecryptionOptionsService.userDecryptionOptionsById$(this.activeAccountId),
      );

      if (
        !userDecryptionOptions?.trustedDeviceOption?.hasAdminApproval &&
        !userDecryptionOptions?.hasMasterPassword
      ) {
        /**
         * We are dealing with a new account if both are true:
         * - User does NOT have admin approval (i.e. has not enrolled in admin reset)
         * - User does NOT have a master password
         */
        await this.loadNewUserData();
      } else {
        this.loadExistingUserUntrustedDeviceData(userDecryptionOptions);
      }
    } catch (err) {
      this.validationService.showError(err);
    } finally {
      this.loading = false;
    }
  }

  private async handleMissingEmail() {
    // TODO: PM-15174 - the solution for this bug will allow us to show the toast on app re-init after
    // the user has been logged out and the process reload has occurred.
    this.toastService.showToast({
      variant: "error",
      title: null,
      message: this.i18nService.t("activeUserEmailNotFoundLoggingYouOut"),
    });

    await this.logoutService.logout(this.activeAccountId);
    // navigate to root so redirect guard can properly route next active user or null user to correct page
    await this.router.navigate(["/"]);
  }

  private observeAndPersistRememberDeviceValueChanges() {
    this.rememberDeviceControl.valueChanges
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((value) =>
          defer(() => this.deviceTrustService.setShouldTrustDevice(this.activeAccountId, value)),
        ),
      )
      .subscribe();
  }

  private async setRememberDeviceDefaultValueFromState() {
    const rememberDeviceFromState = await this.deviceTrustService.getShouldTrustDevice(
      this.activeAccountId,
    );

    const rememberDevice = rememberDeviceFromState ?? true;

    this.rememberDeviceControl.setValue(rememberDevice);
  }

  private async loadNewUserData() {
    this.state = State.NewUser;

    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
      pageTitle: {
        key: "loggedInExclamation",
      },
      pageSubtitle: {
        key: "rememberThisDeviceToMakeFutureLoginsSeamless",
      },
    });

    const autoEnrollStatus$ = defer(() =>
      this.ssoLoginService.getActiveUserOrganizationSsoIdentifier(this.activeAccountId),
    ).pipe(
      switchMap((organizationIdentifier) => {
        if (organizationIdentifier == undefined) {
          return throwError(() => new Error(this.i18nService.t("ssoIdentifierRequired")));
        }

        return from(this.organizationApiService.getAutoEnrollStatus(organizationIdentifier));
      }),
      catchError((err: unknown) => {
        this.validationService.showError(err);
        return of(undefined);
      }),
    );

    const autoEnrollStatus = await firstValueFrom(autoEnrollStatus$);

    this.newUserOrgId = autoEnrollStatus.id;
  }

  private loadExistingUserUntrustedDeviceData(userDecryptionOptions: UserDecryptionOptions) {
    this.state = State.ExistingUserUntrustedDevice;

    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
      pageTitle: {
        key: "deviceApprovalRequiredV2",
      },
      pageSubtitle: {
        key: "selectAnApprovalOptionBelow",
      },
    });

    this.canApproveFromOtherDevice =
      userDecryptionOptions?.trustedDeviceOption?.hasLoginApprovingDevice || false;
    this.canRequestAdminApproval =
      userDecryptionOptions?.trustedDeviceOption?.hasAdminApproval || false;
    this.canApproveWithMasterPassword = userDecryptionOptions?.hasMasterPassword || false;
  }

  protected createUser = async () => {
    if (this.state !== State.NewUser) {
      return;
    }

    try {
      const { publicKey, privateKey } = await this.keyService.initAccount(this.activeAccountId);
      const keysRequest = new KeysRequest(publicKey, privateKey.encryptedString);
      await this.apiService.postAccountKeys(keysRequest);

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("accountSuccessfullyCreated"),
      });

      await this.passwordResetEnrollmentService.enroll(this.newUserOrgId);

      if (this.formGroup.value.rememberDevice) {
        await this.deviceTrustService.trustDevice(this.activeAccountId);
      }

      await this.loginDecryptionOptionsService.handleCreateUserSuccess();

      if (this.clientType === ClientType.Desktop) {
        this.messagingService.send("redrawMenu");
      }

      await this.handleCreateUserSuccessNavigation();
    } catch (err) {
      this.validationService.showError(err);
    }
  };

  private async handleCreateUserSuccessNavigation() {
    if (this.clientType === ClientType.Browser) {
      await this.router.navigate(["/tabs/vault"]);
    } else {
      await this.router.navigate(["/vault"]);
    }
  }

  protected async approveFromOtherDevice() {
    await this.router.navigate(["/login-with-device"]);
  }

  protected async approveWithMasterPassword() {
    await this.router.navigate(["/lock"], {
      queryParams: {
        from: "login-initiated",
      },
    });
  }

  protected async requestAdminApproval() {
    await this.router.navigate(["/admin-approval-requested"]);
  }

  async logOut() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "logOut" },
      content: { key: "logOutConfirmation" },
      acceptButtonText: { key: "logOut" },
      type: "warning",
    });

    const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    if (confirmed) {
      await this.logoutService.logout(userId);
      // navigate to root so redirect guard can properly route next active user or null user to correct page
      await this.router.navigate(["/"]);
    }
  }
}
