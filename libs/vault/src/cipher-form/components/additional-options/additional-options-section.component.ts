// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, inject, Input, OnInit, ViewChild } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { combineLatest, concatMap, filter, map, shareReplay } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ClientType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { devFlagEnabled } from "@bitwarden/common/platform/misc/flags";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import {
  CardComponent,
  CheckboxModule,
  FormFieldModule,
  LinkModule,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

import { PasswordRepromptService } from "../../../services/password-reprompt.service";
import { CipherFormContainer } from "../../cipher-form-container";
import { CipherFormHTTPAuthenticationService } from "../../services/cipher-form-http-authentication.service";
import { CustomFieldsComponent } from "../custom-fields/custom-fields.component";

const HTTP_AUTHENTICATION_HELP_ARTICLE_URL = "https://bitwarden.com/help/basic-auth-autofill/";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-additional-options-section",
  templateUrl: "./additional-options-section.component.html",
  imports: [
    CommonModule,
    SectionHeaderComponent,
    TypographyModule,
    JslibModule,
    CardComponent,
    FormFieldModule,
    ReactiveFormsModule,
    CheckboxModule,
    CommonModule,
    CustomFieldsComponent,
    LinkModule,
  ],
})
export class AdditionalOptionsSectionComponent implements OnInit {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild(CustomFieldsComponent) customFieldsComponent: CustomFieldsComponent;

  private httpAuthenticationService = inject(CipherFormHTTPAuthenticationService);
  private configService = inject(ConfigService);
  private platformUtilsService = inject(PlatformUtilsService);

  additionalOptionsForm = this.formBuilder.group({
    notes: [null as string],
    reprompt: [false],
    httpAuthentication: this.httpAuthenticationService.httpAuthenticationControl,
  });

  passwordRepromptEnabled$ = this.passwordRepromptService.enabled$.pipe(
    shareReplay({ refCount: false, bufferSize: 1 }),
  );

  private readonly isSafariExtension =
    this.platformUtilsService.getClientType() === ClientType.Browser &&
    this.platformUtilsService.isSafari();

  /**
   * True when the HTTP authentication setting is shown. The cipher-level controls are also gated
   * behind a dev flag while their storage work is completed.
   */
  protected readonly showHTTPAuthenticationCipherSetting = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.EnableBasicAuthResponse).pipe(
      map(
        (httpAuthenticationEnabled) =>
          httpAuthenticationEnabled &&
          devFlagEnabled("httpAuthenticationCipherControls") &&
          // The Safari extension does not respond to HTTP authentication
          // prompts, so the setting is not offered there.
          !this.isSafariExtension &&
          this.cipherFormContainer.config.cipherType === CipherType.Login,
      ),
    ),
    { initialValue: false },
  );

  /** True when a URI uses the default match strategy, which prevents HTTP authentication from being used */
  protected readonly httpAuthenticationBlockedByMatchStrategy = toSignal(
    this.httpAuthenticationService.allUrisHaveExplicitMatchStrategy$.pipe(
      map((allExplicit) => !allExplicit),
    ),
    { initialValue: false },
  );

  /** When false when the add field button should be displayed in the Additional Options section  */
  hasCustomFields = false;

  /** True when the form is in `partial-edit` mode */
  isPartialEdit = false;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() disableSectionMargin: boolean;

  /** True when the form allows new fields to be added */
  get allowNewField(): boolean {
    return this.additionalOptionsForm.enabled;
  }

  constructor(
    private cipherFormContainer: CipherFormContainer,
    private formBuilder: FormBuilder,
    private passwordRepromptService: PasswordRepromptService,
    private changeDetectorRef: ChangeDetectorRef,
  ) {
    this.cipherFormContainer.registerChildForm("additionalOptions", this.additionalOptionsForm);

    // TODO(PM-45263): Patch the HTTP authentication value once it is stored on the cipher, and hide
    // the setting for organization-owned and legacy-format ciphers, which can't hold it.
    this.additionalOptionsForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.cipherFormContainer.patchCipher((cipher) => {
        cipher.notes = value.notes;
        cipher.reprompt = value.reprompt ? CipherRepromptType.Password : CipherRepromptType.None;
        return cipher;
      });
    });

    this.enforceRepromptAndHTTPAuthenticationExclusivity();

    combineLatest([
      this.httpAuthenticationService.allUrisHaveExplicitMatchStrategy$,
      this.cipherFormContainer.formStatusChange$,
    ])
      .pipe(takeUntilDestroyed())
      .subscribe(([allUrisHaveExplicitMatchStrategy, formStatus]) => {
        this.updateHTTPAuthenticationDisabledState(allUrisHaveExplicitMatchStrategy, formStatus);
      });
  }

  ngOnInit() {
    const prefillCipher = this.cipherFormContainer.getInitialCipherView();

    if (prefillCipher) {
      this.additionalOptionsForm.patchValue({
        notes: prefillCipher.notes,
        reprompt: prefillCipher.reprompt === CipherRepromptType.Password,
      });
    }

    if (this.cipherFormContainer.config.mode === "partial-edit") {
      this.additionalOptionsForm.disable();
      this.isPartialEdit = true;
    }
  }

  /**
   * HTTP authentication and master password reprompt can't both be on. Turning either on while the other
   * is on asks the user to confirm turning the other off; declining reverts the change.
   */
  private enforceRepromptAndHTTPAuthenticationExclusivity() {
    const { reprompt, httpAuthentication } = this.additionalOptionsForm.controls;

    httpAuthentication.valueChanges
      .pipe(
        filter((httpAuthenticationEnabled) => httpAuthenticationEnabled && reprompt.value),
        concatMap(() => this.httpAuthenticationService.confirmTurnOnHTTPAuthentication()),
        takeUntilDestroyed(),
      )
      .subscribe((confirmed) => {
        if (confirmed) {
          reprompt.setValue(false);
        } else {
          httpAuthentication.setValue(false);
        }
      });

    reprompt.valueChanges
      .pipe(
        filter((repromptEnabled) => repromptEnabled && httpAuthentication.value),
        concatMap(() => this.httpAuthenticationService.confirmTurnOnReprompt()),
        takeUntilDestroyed(),
      )
      .subscribe((confirmed) => {
        if (confirmed) {
          httpAuthentication.setValue(false);
        } else {
          reprompt.setValue(false);
        }
      });
  }

  /**
   * The HTTP authentication setting is disabled while any URI uses the default match strategy, while the
   * form is disabled, and in `partial-edit` mode.
   */
  private updateHTTPAuthenticationDisabledState(
    allUrisHaveExplicitMatchStrategy: boolean,
    formStatus: "enabled" | "disabled" | null,
  ) {
    const { httpAuthentication } = this.additionalOptionsForm.controls;

    if (
      !allUrisHaveExplicitMatchStrategy ||
      formStatus === "disabled" ||
      this.cipherFormContainer.config.mode === "partial-edit"
    ) {
      httpAuthentication.disable({ emitEvent: false });
    } else {
      httpAuthentication.enable({ emitEvent: false });
    }
  }

  /** Opens the help article for the HTTP authentication setting */
  protected openHTTPAuthenticationHelpArticle(event: Event) {
    event.preventDefault();
    this.platformUtilsService.launchUri(HTTP_AUTHENTICATION_HELP_ARTICLE_URL);
  }

  /** Opens the add custom field dialog */
  addCustomField() {
    this.customFieldsComponent.openAddEditCustomFieldDialog();
  }

  /** Update the local state when the number of fields changes */
  handleCustomFieldChange(numberOfCustomFields: number) {
    this.hasCustomFields = numberOfCustomFields > 0;

    // The event that triggers `handleCustomFieldChange` can occur within
    // the CustomFieldComponent `ngOnInit` lifecycle hook, so we need to
    // manually trigger change detection to update the view.
    this.changeDetectorRef.detectChanges();
  }
}
