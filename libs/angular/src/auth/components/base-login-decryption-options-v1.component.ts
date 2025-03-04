// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
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
  map,
  Observable,
  take,
} from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import {
  LoginEmailServiceAbstraction,
  UserDecryptionOptions,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust.service.abstraction";
import { DevicesServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices/devices.service.abstraction";
import { PasswordResetEnrollmentServiceAbstraction } from "@bitwarden/common/auth/abstractions/password-reset-enrollment.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

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
export class BaseLoginDecryptionOptionsComponentV1 implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  protected State = State;

  protected data?: Data;
  protected loading = true;

  private email$: Observable<string>;

  activeAccountId: UserId;

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
    protected loginEmailService: LoginEmailServiceAbstraction,
    protected organizationApiService: OrganizationApiServiceAbstraction,
    protected keyService: KeyService,
    protected organizationUserApiService: OrganizationUserApiService,
    protected apiService: ApiService,
    protected i18nService: I18nService,
    protected validationService: ValidationService,
    protected deviceTrustService: DeviceTrustServiceAbstraction,
    protected platformUtilsService: PlatformUtilsService,
    protected userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    protected passwordResetEnrollmentService: PasswordResetEnrollmentServiceAbstraction,
    protected ssoLoginService: SsoLoginServiceAbstraction,
    protected accountService: AccountService,
    protected toastService: ToastService,
  ) {}

  async ngOnInit() {
    this.loading = true;
    this.activeAccountId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    this.email$ = this.accountService.activeAccount$.pipe(
      map((a) => a?.email),
      catchError((err: unknown) => {
        this.validationService.showError(err);
        return of(undefined);
      }),
      takeUntil(this.destroy$),
    );

    this.setupRememberDeviceValueChanges();

    // Persist user choice from state if it exists
    await this.setRememberDeviceDefaultValue();

    try {
      const userDecryptionOptions = await firstValueFrom(
        this.userDecryptionOptionsService.userDecryptionOptions$,
      );

      // see sso-login.strategy - to determine if a user is new or not it just checks if there is a key on the token response..
      // can we check if they have a user key or master key in crypto service? Would that be sufficient?
      if (
        !userDecryptionOptions?.trustedDeviceOption?.hasAdminApproval &&
        !userDecryptionOptions?.hasMasterPassword
      ) {
        // We are dealing with a new account if:
        //  - User does not have admin approval (i.e. has not enrolled into admin reset)
        //  - AND does not have a master password

        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.loadNewUserData();
      } else {
        this.loadUntrustedDeviceData(userDecryptionOptions);
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
    const rememberDeviceFromState = await this.deviceTrustService.getShouldTrustDevice(
      this.activeAccountId,
    );

    const rememberDevice = rememberDeviceFromState ?? true;

    this.rememberDevice.setValue(rememberDevice);
  }

  private setupRememberDeviceValueChanges() {
    this.rememberDevice.valueChanges
      .pipe(
        switchMap((value) =>
          defer(() => this.deviceTrustService.setShouldTrustDevice(this.activeAccountId, value)),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  async loadNewUserData() {
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
    const email = await firstValueFrom(this.email$);

    this.data = { state: State.NewUser, organizationId: autoEnrollStatus.id, userEmail: email };
    this.loading = false;
  }

  loadUntrustedDeviceData(userDecryptionOptions: UserDecryptionOptions) {
    this.loading = true;

    this.email$
      .pipe(
        take(1),
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe((email) => {
        const showApproveFromOtherDeviceBtn =
          userDecryptionOptions?.trustedDeviceOption?.hasLoginApprovingDevice || false;

        const showReqAdminApprovalBtn =
          !!userDecryptionOptions?.trustedDeviceOption?.hasAdminApproval || false;

        const showApproveWithMasterPasswordBtn = userDecryptionOptions?.hasMasterPassword || false;

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

    this.loginEmailService.setLoginEmail(this.data.userEmail);
    await this.router.navigate(["/login-with-device"]);
  }

  async requestAdminApproval() {
    this.loginEmailService.setLoginEmail(this.data.userEmail);
    await this.router.navigate(["/admin-approval-requested"]);
  }

  async approveWithMasterPassword() {
    await this.router.navigate(["/lock"], { queryParams: { from: "login-initiated" } });
  }

  async createUser() {
    if (this.data.state !== State.NewUser) {
      return;
    }

    // this.loading to support clients without async-actions-support
    this.loading = true;
    // errors must be caught in child components to prevent navigation
    try {
      const { publicKey, privateKey } = await this.keyService.initAccount();
      const keysRequest = new KeysRequest(publicKey, privateKey.encryptedString);
      await this.apiService.postAccountKeys(keysRequest);

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("accountSuccessfullyCreated"),
      });

      await this.passwordResetEnrollmentService.enroll(this.data.organizationId);

      if (this.rememberDeviceForm.value.rememberDevice) {
        await this.deviceTrustService.trustDevice(this.activeAccountId);
      }
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
