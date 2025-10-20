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
import {
  concatMap,
  firstValueFrom,
  pairwise,
  startWith,
  Subject,
  switchMap,
  takeUntil,
} from "rxjs";

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

  loading = true;
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

    // Only setup listener if key connector is a possible selection
    if (this.showKeyConnectorOptions) {
      this.listenForKeyConnectorSelection();
    }
  }

  listenForKeyConnectorSelection() {
    const memberDecryptionTypeOnInit = this.ssoConfigForm?.controls?.memberDecryptionType.value;

    this.ssoConfigForm?.controls?.memberDecryptionType.valueChanges
      .pipe(
        startWith(memberDecryptionTypeOnInit),
        pairwise(),
        switchMap(async ([prevMemberDecryptionType, newMemberDecryptionType]) => {
          // Only pre-populate a default URL when changing TO Key Connector from a different decryption type.
          // ValueChanges gets re-triggered during the submit() call, so we need a !== check
          // to prevent a custom URL from getting overwritten back to the default on a submit().
          if (
            prevMemberDecryptionType !== MemberDecryptionType.KeyConnector &&
            newMemberDecryptionType === MemberDecryptionType.KeyConnector
          ) {
            // Pre-populate a default key connector URL (user can still change it)
            const env = await firstValueFrom(this.environmentService.environment$);
            const webVaultUrl = env.getWebVaultUrl();
            const defaultKeyConnectorUrl = webVaultUrl + "/key-connector";

            this.ssoConfigForm.controls.keyConnectorUrl.setValue(defaultKeyConnectorUrl);
          } else if (newMemberDecryptionType !== MemberDecryptionType.KeyConnector) {
            this.ssoConfigForm.controls.keyConnectorUrl.setValue("");
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async load() {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.organization = await firstValueFrom(
      this.organizationService
        .organizations$(userId)
        .pipe(getOrganizationById(this.organizationId)),
    );
    const ssoSettings = await this.organizationApiService.getSso(this.organizationId);
    this.populateForm(ssoSettings);

    this.callbackPath = ssoSettings.urls.callbackPath;
    this.signedOutCallbackPath = ssoSettings.urls.signedOutCallbackPath;
    this.spEntityId = ssoSettings.urls.spEntityId;
    this.spEntityIdStatic = ssoSettings.urls.spEntityIdStatic;
    this.spMetadataUrl = ssoSettings.urls.spMetadataUrl;
    this.spAcsUrl = ssoSettings.urls.spAcsUrl;

    this.loading = false;
  }

  submit = async () => {
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
    request.identifier = this.ssoIdentifierCtrl.value === "" ? null : this.ssoIdentifierCtrl.value;
    request.data = SsoConfigApi.fromView(this.ssoConfigForm.getRawValue());

    const response = await this.organizationApiService.updateSso(this.organizationId, request);
    this.populateForm(response);

    await this.upsertOrganizationWithSsoChanges(request);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("ssoSettingsSaved"),
    });
  };

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
