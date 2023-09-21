import { Directive, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormControl } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import {
  firstValueFrom,
  switchMap,
  Subject,
  catchError,
  from,
  of,
  finalize,
  takeUntil,
  defer,
  throwError,
} from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { DevicesServiceAbstraction } from "@bitwarden/common/abstractions/devices/devices.service.abstraction";
import { OrganizationUserService } from "@bitwarden/common/abstractions/organization-user/organization-user.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { DeviceTrustCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust-crypto.service.abstraction";
import { LoginService } from "@bitwarden/common/auth/abstractions/login.service";
import { PasswordResetEnrollmentServiceAbstraction } from "@bitwarden/common/auth/abstractions/password-reset-enrollment.service.abstraction";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { AccountDecryptionOptions } from "@bitwarden/common/platform/models/domain/account";

enum State {
  NewUser,
  ExistingUserUntrustedDevice,
}

type NewUserData = {
  readonly state: State.NewUser;
  readonly organizationId: string;
  readonly userEmail: string;
};

type ExistingUserUntrustedDeviceData = {
  readonly state: State.ExistingUserUntrustedDevice;
  readonly showApproveFromOtherDeviceBtn: boolean;
  readonly showReqAdminApprovalBtn: boolean;
  readonly showApproveWithMasterPasswordBtn: boolean;
  readonly userEmail: string;
};

type Data = NewUserData | ExistingUserUntrustedDeviceData;

@Directive()
export class BaseLoginDecryptionOptionsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  protected State = State;

  protected data?: Data;
  protected loading = true;

  // Remember device means for the user to trust the device
  rememberDeviceForm = this.formBuilder.group({
    rememberDevice: [true],
  });

  get rememberDevice(): FormControl<boolean> {
    return this.rememberDeviceForm?.controls.rememberDevice;
  }

  constructor(
    protected formBuilder: FormBuilder,
    protected devicesService: DevicesServiceAbstraction,
    protected stateService: StateService,
    protected router: Router,
    protected activatedRoute: ActivatedRoute,
    protected messagingService: MessagingService,
    protected tokenService: TokenService,
    protected loginService: LoginService,
    protected organizationApiService: OrganizationApiServiceAbstraction,
    protected cryptoService: CryptoService,
    protected organizationUserService: OrganizationUserService,
    protected apiService: ApiService,
    protected i18nService: I18nService,
    protected validationService: ValidationService,
    protected deviceTrustCryptoService: DeviceTrustCryptoServiceAbstraction,
    protected platformUtilsService: PlatformUtilsService,
    protected passwordResetEnrollmentService: PasswordResetEnrollmentServiceAbstraction
  ) {}

  async ngOnInit() {
    this.loading = true;

    this.setupRememberDeviceValueChanges();

    // Persist user choice from state if it exists
    await this.setRememberDeviceDefaultValue();

    try {
      const accountDecryptionOptions: AccountDecryptionOptions =
        await this.stateService.getAccountDecryptionOptions();

      // see sso-login.strategy - to determine if a user is new or not it just checks if there is a key on the token response..
      // can we check if they have a user key or master key in crypto service? Would that be sufficient?
      if (
        !accountDecryptionOptions?.trustedDeviceOption?.hasAdminApproval &&
        !accountDecryptionOptions?.hasMasterPassword
      ) {
        // We are dealing with a new account if:
        //  - User does not have admin approval (i.e. has not enrolled into admin reset)
        //  - AND does not have a master password

        this.loadNewUserData();
      } else {
        this.loadUntrustedDeviceData(accountDecryptionOptions);
      }

      // Note: this is probably not a comprehensive write up of all scenarios:

      // If the TDE feature flag is enabled and TDE is configured for the org that the user is a member of,
      // then new and existing users can be redirected here after completing the SSO flow (and 2FA if enabled).

      // First we must determine user type (new or existing):

      // New User
      // - present user with option to remember the device or not (trust the device)
      // - present a continue button to proceed to the vault
      //  - loadNewUserData() --> will need to load enrollment status and user email address.

      // Existing User
      // - Determine if user is an admin with access to account recovery in admin console
      //  - Determine if user has a MP or not, if not, they must be redirected to set one (see PM-1035)
      // - Determine if device is trusted or not via device crypto service (method not yet written)
      //  - If not trusted, present user with login decryption options (approve from other device, approve with master password, request admin approval)
      //    - loadUntrustedDeviceData()
    } catch (err) {
      this.validationService.showError(err);
    }
  }

  private async setRememberDeviceDefaultValue() {
    const rememberDeviceFromState = await this.deviceTrustCryptoService.getShouldTrustDevice();

    const rememberDevice = rememberDeviceFromState ?? true;

    this.rememberDevice.setValue(rememberDevice);
  }

  private setupRememberDeviceValueChanges() {
    this.rememberDevice.valueChanges
      .pipe(
        switchMap((value) =>
          defer(() => this.deviceTrustCryptoService.setShouldTrustDevice(value))
        ),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  async loadNewUserData() {
    const autoEnrollStatus$ = defer(() =>
      this.stateService.getUserSsoOrganizationIdentifier()
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
      })
    );

    const email$ = from(this.stateService.getEmail()).pipe(
      catchError((err: unknown) => {
        this.validationService.showError(err);
        return of(undefined);
      }),
      takeUntil(this.destroy$)
    );

    const autoEnrollStatus = await firstValueFrom(autoEnrollStatus$);
    const email = await firstValueFrom(email$);

    this.data = { state: State.NewUser, organizationId: autoEnrollStatus.id, userEmail: email };
    this.loading = false;
  }

  loadUntrustedDeviceData(accountDecryptionOptions: AccountDecryptionOptions) {
    this.loading = true;

    const email$ = from(this.stateService.getEmail()).pipe(
      catchError((err: unknown) => {
        this.validationService.showError(err);
        return of(undefined);
      }),
      takeUntil(this.destroy$)
    );

    email$
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((email) => {
        const showApproveFromOtherDeviceBtn =
          accountDecryptionOptions?.trustedDeviceOption?.hasLoginApprovingDevice || false;

        const showReqAdminApprovalBtn =
          !!accountDecryptionOptions?.trustedDeviceOption?.hasAdminApproval || false;

        const showApproveWithMasterPasswordBtn =
          accountDecryptionOptions?.hasMasterPassword || false;

        const userEmail = email;

        this.data = {
          state: State.ExistingUserUntrustedDevice,
          showApproveFromOtherDeviceBtn,
          showReqAdminApprovalBtn,
          showApproveWithMasterPasswordBtn,
          userEmail,
        };
      });
  }

  async approveFromOtherDevice() {
    if (this.data.state !== State.ExistingUserUntrustedDevice) {
      return;
    }

    this.loginService.setEmail(this.data.userEmail);
    this.router.navigate(["/login-with-device"]);
  }

  async requestAdminApproval() {
    this.loginService.setEmail(this.data.userEmail);
    this.router.navigate(["/admin-approval-requested"]);
  }

  async approveWithMasterPassword() {
    this.router.navigate(["/lock"], { queryParams: { from: "login-initiated" } });
  }

  async createUser() {
    if (this.data.state !== State.NewUser) {
      return;
    }

    // this.loading to support clients without async-actions-support
    this.loading = true;
    try {
      const { publicKey, privateKey } = await this.cryptoService.initAccount();
      const keysRequest = new KeysRequest(publicKey, privateKey.encryptedString);
      await this.apiService.postAccountKeys(keysRequest);

      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("accountSuccessfullyCreated")
      );

      await this.passwordResetEnrollmentService.enroll(this.data.organizationId);

      if (this.rememberDeviceForm.value.rememberDevice) {
        await this.deviceTrustCryptoService.trustDevice();
      }
    } catch (error) {
      this.validationService.showError(error);
    } finally {
      this.loading = false;
    }
  }

  logOut() {
    this.loading = true; // to avoid an awkward delay in browser extension
    this.messagingService.send("logout");
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
