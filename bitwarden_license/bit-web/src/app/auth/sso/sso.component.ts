// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  UntypedFormGroup,
  Validators,
} from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { concatMap, firstValueFrom, Subject, Subscription, switchMap, takeUntil } from "rxjs";

import { ControlsOf } from "@bitwarden/angular/types/controls-of";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import {
  getOrganizationById,
  InternalOrganizationServiceAbstraction,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationData } from "@bitwarden/common/admin-console/models/data/organization.data";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  MemberDecryptionType,
  OpenIdConnectRedirectBehavior,
  Saml2BindingType,
  Saml2NameIdFormat,
  Saml2SigningBehavior,
  SsoType,
} from "@bitwarden/common/auth/enums/sso";
import { SsoConfigApi } from "@bitwarden/common/auth/models/api/sso-config.api";
import { OrganizationSsoRequest } from "@bitwarden/common/auth/models/request/organization-sso.request";
import { OrganizationSsoResponse } from "@bitwarden/common/auth/models/response/organization-sso.response";
import { SsoConfigView } from "@bitwarden/common/auth/models/view/sso-config.view";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ToastService } from "@bitwarden/components";

import { ssoTypeValidator } from "./sso-type.validator";

interface SelectOptions {
  name: string;
  value: any;
  disabled?: boolean;
}

const defaultSigningAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-org-manage-sso",
  templateUrl: "sso.component.html",
  standalone: false,
})
export class SsoComponent implements OnInit, OnDestroy {
  readonly ssoType = SsoType;
  readonly memberDecryptionType = MemberDecryptionType;

  readonly ssoTypeOptions: SelectOptions[] = [
    { name: this.i18nService.t("selectType"), value: SsoType.None, disabled: true },
    { name: "OpenID Connect", value: SsoType.OpenIdConnect },
    { name: "SAML 2.0", value: SsoType.Saml2 },
  ];

  readonly samlSigningAlgorithms = [
    "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    "http://www.w3.org/2001/04/xmldsig-more#rsa-sha384",
    "http://www.w3.org/2001/04/xmldsig-more#rsa-sha512",
  ];

  readonly samlSigningAlgorithmOptions: SelectOptions[] = this.samlSigningAlgorithms.map(
    (algorithm) => ({ name: algorithm, value: algorithm }),
  );

  readonly saml2SigningBehaviourOptions: SelectOptions[] = [
    {
      name: "If IdP Wants Authn Requests Signed",
      value: Saml2SigningBehavior.IfIdpWantAuthnRequestsSigned,
    },
    { name: "Always", value: Saml2SigningBehavior.Always },
    { name: "Never", value: Saml2SigningBehavior.Never },
  ];
  readonly saml2BindingTypeOptions: SelectOptions[] = [
    { name: "Redirect", value: Saml2BindingType.HttpRedirect },
    { name: "HTTP POST", value: Saml2BindingType.HttpPost },
  ];
  readonly saml2NameIdFormatOptions: SelectOptions[] = [
    { name: "Not Configured", value: Saml2NameIdFormat.NotConfigured },
    { name: "Unspecified", value: Saml2NameIdFormat.Unspecified },
    { name: "Email Address", value: Saml2NameIdFormat.EmailAddress },
    { name: "X.509 Subject Name", value: Saml2NameIdFormat.X509SubjectName },
    { name: "Windows Domain Qualified Name", value: Saml2NameIdFormat.WindowsDomainQualifiedName },
    { name: "Kerberos Principal Name", value: Saml2NameIdFormat.KerberosPrincipalName },
    { name: "Entity Identifier", value: Saml2NameIdFormat.EntityIdentifier },
    { name: "Persistent", value: Saml2NameIdFormat.Persistent },
    { name: "Transient", value: Saml2NameIdFormat.Transient },
  ];

  readonly connectRedirectOptions: SelectOptions[] = [
    { name: "Redirect GET", value: OpenIdConnectRedirectBehavior.RedirectGet },
    { name: "Form POST", value: OpenIdConnectRedirectBehavior.FormPost },
  ];

  private destroy$ = new Subject<void>();
  showTdeOptions = false;
  showKeyConnectorOptions = false;

  showOpenIdCustomizations = false;

  isInitializing = true; // concerned with UI/UX (i.e. when to show loading spinner vs form)
  isFormValidatingOrPopulating = true; // tracks when form fields are being validated/populated during load() or submit()

  configuredKeyConnectorUrlFromServer: string | null;
  memberDecryptionTypeValueChangesSubscription: Subscription | null = null;
  haveTestedKeyConnector = false;
  organizationId: string;
  organization: Organization;

  callbackPath: string;
  signedOutCallbackPath: string;
  spEntityId: string;
  spEntityIdStatic: string;
  spMetadataUrl: string;
  spAcsUrl: string;

  showClientSecret = false;

  protected openIdForm = this.formBuilder.group<ControlsOf<SsoConfigView["openId"]>>(
    {
      authority: new FormControl("", Validators.required),
      clientId: new FormControl("", Validators.required),
      clientSecret: new FormControl("", Validators.required),
      metadataAddress: new FormControl(),
      redirectBehavior: new FormControl(
        OpenIdConnectRedirectBehavior.RedirectGet,
        Validators.required,
      ),
      getClaimsFromUserInfoEndpoint: new FormControl(),
      additionalScopes: new FormControl(),
      additionalUserIdClaimTypes: new FormControl(),
      additionalEmailClaimTypes: new FormControl(),
      additionalNameClaimTypes: new FormControl(),
      acrValues: new FormControl(),
      expectedReturnAcrValue: new FormControl(),
    },
    {
      updateOn: "blur",
    },
  );

  protected samlForm = this.formBuilder.group<ControlsOf<SsoConfigView["saml"]>>(
    {
      spUniqueEntityId: new FormControl(true, { updateOn: "change" }),
      spNameIdFormat: new FormControl(Saml2NameIdFormat.NotConfigured),
      spOutboundSigningAlgorithm: new FormControl(defaultSigningAlgorithm),
      spSigningBehavior: new FormControl(Saml2SigningBehavior.IfIdpWantAuthnRequestsSigned),
      spMinIncomingSigningAlgorithm: new FormControl(defaultSigningAlgorithm),
      spWantAssertionsSigned: new FormControl(),
      spValidateCertificates: new FormControl(),

      idpEntityId: new FormControl("", Validators.required),
      idpBindingType: new FormControl(Saml2BindingType.HttpRedirect),
      idpSingleSignOnServiceUrl: new FormControl("", Validators.required),
      idpSingleLogoutServiceUrl: new FormControl(),
      idpX509PublicCert: new FormControl("", Validators.required),
      idpOutboundSigningAlgorithm: new FormControl(defaultSigningAlgorithm),
      idpAllowUnsolicitedAuthnResponse: new FormControl(),
      idpAllowOutboundLogoutRequests: new FormControl(true),
      idpWantAuthnRequestsSigned: new FormControl(),
    },
    {
      updateOn: "blur",
    },
  );

  protected ssoConfigForm = this.formBuilder.group<ControlsOf<SsoConfigView>>({
    configType: new FormControl(SsoType.None),
    memberDecryptionType: new FormControl(MemberDecryptionType.MasterPassword),
    keyConnectorUrl: new FormControl(""),
    openId: this.openIdForm,
    saml: this.samlForm,
    enabled: new FormControl(false),
    ssoIdentifier: new FormControl("", {
      validators: [Validators.maxLength(50), Validators.required],
    }),
  });

  get enabledCtrl() {
    return this.ssoConfigForm?.controls?.enabled as FormControl;
  }
  get ssoIdentifierCtrl() {
    return this.ssoConfigForm?.controls?.ssoIdentifier as FormControl;
  }
  get configTypeCtrl() {
    return this.ssoConfigForm?.controls?.configType as FormControl;
  }

  constructor(
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private organizationService: InternalOrganizationServiceAbstraction,
    private accountService: AccountService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private toastService: ToastService,
    private environmentService: EnvironmentService,
  ) {}

  async ngOnInit() {
    this.enabledCtrl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((enabled) => {
      if (enabled) {
        this.ssoIdentifierCtrl.setValidators([Validators.maxLength(50), Validators.required]);
        this.configTypeCtrl.setValidators([
          ssoTypeValidator(this.i18nService.t("selectionIsRequired")),
        ]);
      } else {
        this.ssoIdentifierCtrl.setValidators([]);
        this.configTypeCtrl.setValidators([]);
      }

      this.ssoIdentifierCtrl.updateValueAndValidity();
      this.configTypeCtrl.updateValueAndValidity();
    });

    this.ssoConfigForm
      .get("configType")
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((newType: SsoType) => {
        if (newType === SsoType.OpenIdConnect) {
          this.openIdForm.enable();
          this.samlForm.disable();
        } else if (newType === SsoType.Saml2) {
          this.openIdForm.disable();
          this.samlForm.enable();
        } else {
          this.openIdForm.disable();
          this.samlForm.disable();
        }
      });

    this.samlForm
      .get("spSigningBehavior")
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.samlForm.get("idpX509PublicCert").updateValueAndValidity());

    this.route.params
      .pipe(
        concatMap(async (params) => {
          this.organizationId = params.organizationId;
          await this.load();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.showKeyConnectorOptions = this.platformUtilsService.isSelfHost();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async load() {
    // Even though these component properties were initialized to true, we must always reset
    // them to true at the top of this method in case an admin navigates to another org via
    // the browser address bar, which re-executes load() on the same component instance
    // (not a new instance).
    this.isInitializing = true;
    this.isFormValidatingOrPopulating = true;

    try {
      const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
      this.organization = await firstValueFrom(
        this.organizationService
          .organizations$(userId)
          .pipe(getOrganizationById(this.organizationId)),
      );
      const ssoSettings = await this.organizationApiService.getSso(this.organizationId);
      this.configuredKeyConnectorUrlFromServer = ssoSettings.data?.keyConnectorUrl;
      this.populateForm(ssoSettings);

      this.callbackPath = ssoSettings.urls.callbackPath;
      this.signedOutCallbackPath = ssoSettings.urls.signedOutCallbackPath;
      this.spEntityId = ssoSettings.urls.spEntityId;
      this.spEntityIdStatic = ssoSettings.urls.spEntityIdStatic;
      this.spMetadataUrl = ssoSettings.urls.spMetadataUrl;
      this.spAcsUrl = ssoSettings.urls.spAcsUrl;
    } finally {
      this.isInitializing = false;
      this.isFormValidatingOrPopulating = false;
    }

    if (this.showKeyConnectorOptions) {
      // We don't setup this subscription until AFTER the form has been populated on load().
      // This is because populateForm() will trigger valueChanges, but we don't want to
      // listen for or react to valueChanges until AFTER the form has had a chance to be
      // populated with already configured values retrieved from the server.
      this.subscribeToMemberDecryptionTypeValueChanges();
    }
  }

  submit = async () => {
    this.isFormValidatingOrPopulating = true;

    try {
      this.updateFormValidationState(this.ssoConfigForm);

      if (this.ssoConfigForm.value.memberDecryptionType === MemberDecryptionType.KeyConnector) {
        this.haveTestedKeyConnector = false;
        await this.validateKeyConnectorUrl();
      }

      if (!this.ssoConfigForm.valid) {
        this.readOutErrors();
        return;
      }
      const request = new OrganizationSsoRequest();
      request.enabled = this.enabledCtrl.value;
      // Return null instead of empty string to avoid duplicate id errors in database
      request.identifier =
        this.ssoIdentifierCtrl.value === "" ? null : this.ssoIdentifierCtrl.value;
      request.data = SsoConfigApi.fromView(this.ssoConfigForm.getRawValue());

      const response = await this.organizationApiService.updateSso(this.organizationId, request);
      this.configuredKeyConnectorUrlFromServer = response.data?.keyConnectorUrl;
      this.populateForm(response);

      await this.upsertOrganizationWithSsoChanges(request);

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("ssoSettingsSaved"),
      });
    } finally {
      this.isFormValidatingOrPopulating = false;
    }
  };

  private subscribeToMemberDecryptionTypeValueChanges() {
    // We must unsubscribe from any existing subscription because an admin could navigate to
    // another org via the browser address bar, which re-executes load() on the same component
    // instance (not a new instance) and therefore would not unsubscribe via takeUntil(this.destroy$).
    // The load() call then re-executes subscribeToMemberDecryptionTypeValueChanges(), setting up a subscription.
    this.memberDecryptionTypeValueChangesSubscription?.unsubscribe();

    this.memberDecryptionTypeValueChangesSubscription =
      this.ssoConfigForm?.controls?.memberDecryptionType.valueChanges
        .pipe(
          switchMap(async (memberDecryptionType: MemberDecryptionType) => {
            if (this.isFormValidatingOrPopulating) {
              // If the form is being validated/populated due to a load() or submit() call (both of which
              // trigger valueChanges) we don't want to react to this valueChanges emission.
              return;
            }

            if (memberDecryptionType === MemberDecryptionType.KeyConnector) {
              if (this.configuredKeyConnectorUrlFromServer) {
                // If the user already has a key connector URL configured, it will have been retrieved
                // from the server and set to the form field upon load(). But if this user then selects a
                // different Member Decryption option (but does not save the form), and then once again
                // selects the Key Connector option, we want to pre-populate the form field with the already
                // configured URL that was originally retreived from the server, not a default URL.
                this.ssoConfigForm.controls.keyConnectorUrl.setValue(
                  this.configuredKeyConnectorUrlFromServer,
                );
                return;
              }

              // Pre-populate a default key connector URL (user can still change it)
              const env = await firstValueFrom(this.environmentService.environment$);
              const webVaultUrl = env.getWebVaultUrl();
              const defaultKeyConnectorUrl = webVaultUrl + "/key-connector";

              this.ssoConfigForm.controls.keyConnectorUrl.setValue(defaultKeyConnectorUrl);
            } else {
              // Clear the key connector url
              this.ssoConfigForm.controls.keyConnectorUrl.setValue("");
            }
          }),
          takeUntil(this.destroy$),
        )
        .subscribe();
  }

  async validateKeyConnectorUrl() {
    if (this.haveTestedKeyConnector) {
      return;
    }

    this.keyConnectorUrl.markAsPending();

    try {
      await this.apiService.getKeyConnectorAlive(this.keyConnectorUrl.value);
      this.keyConnectorUrl.updateValueAndValidity();
    } catch {
      this.keyConnectorUrl.setErrors({
        invalidUrl: { message: this.i18nService.t("keyConnectorTestFail") },
      });
      this.keyConnectorUrl.markAllAsTouched();
    }

    this.haveTestedKeyConnector = true;
  }

  toggleOpenIdCustomizations() {
    this.showOpenIdCustomizations = !this.showOpenIdCustomizations;
  }

  getErrorCount(form: UntypedFormGroup): number {
    return Object.values(form.controls).reduce((acc: number, control: AbstractControl) => {
      if (control instanceof UntypedFormGroup) {
        return acc + this.getErrorCount(control);
      }

      if (control.errors == null) {
        return acc;
      }
      return acc + Object.keys(control.errors).length;
    }, 0);
  }

  get enableTestKeyConnector() {
    return (
      this.ssoConfigForm.value?.memberDecryptionType === MemberDecryptionType.KeyConnector &&
      !Utils.isNullOrWhitespace(this.keyConnectorUrl?.value)
    );
  }

  get keyConnectorUrl() {
    return this.ssoConfigForm.get("keyConnectorUrl");
  }

  /**
   * Shows any validation errors for the form by marking all controls as dirty and touched.
   * If nested form groups are found, they are also updated.
   * @param form - the form to show validation errors for
   */
  private updateFormValidationState(form: UntypedFormGroup) {
    Object.values(form.controls).forEach((control: AbstractControl) => {
      if (control.disabled) {
        return;
      }

      if (control instanceof UntypedFormGroup) {
        this.updateFormValidationState(control);
      } else {
        control.markAsDirty();
        control.markAsTouched();
        control.updateValueAndValidity();
      }
    });
  }

  private populateForm(orgSsoResponse: OrganizationSsoResponse) {
    const ssoConfigView = new SsoConfigView(orgSsoResponse);
    this.ssoConfigForm.patchValue(ssoConfigView);
  }

  private readOutErrors() {
    const errorText = this.i18nService.t("error");
    const errorCount = this.getErrorCount(this.ssoConfigForm);
    const errorCountText = this.i18nService.t(
      errorCount === 1 ? "formErrorSummarySingle" : "formErrorSummaryPlural",
      errorCount.toString(),
    );

    const div = document.createElement("div");
    div.className = "tw-sr-only";
    div.id = "srErrorCount";
    div.setAttribute("aria-live", "polite");
    div.innerText = errorText + ": " + errorCountText;

    const existing = document.getElementById("srErrorCount");
    if (existing != null) {
      existing.remove();
    }

    document.body.append(div);
  }

  private async upsertOrganizationWithSsoChanges(
    organizationSsoRequest: OrganizationSsoRequest,
  ): Promise<void> {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const currentOrganization = await firstValueFrom(
      this.organizationService
        .organizations$(userId)
        .pipe(getOrganizationById(this.organizationId)),
    );

    if (currentOrganization) {
      const updatedOrganization: OrganizationData = {
        ...currentOrganization,
        ssoEnabled: organizationSsoRequest.enabled,
        ssoMemberDecryptionType: organizationSsoRequest.data.memberDecryptionType,
      };

      await this.organizationService.upsert(updatedOrganization, userId);
    }
  }
}
