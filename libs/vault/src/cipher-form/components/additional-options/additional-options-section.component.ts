// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, inject, Input, OnInit, ViewChild } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { firstValueFrom, map, shareReplay } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { ClientType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { devFlagEnabled } from "@bitwarden/common/platform/misc/flags";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import {
  CardComponent,
  CheckboxModule,
  DialogService,
  FormFieldModule,
  LinkModule,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

import { PasswordRepromptService } from "../../../services/password-reprompt.service";
import { CipherFormContainer } from "../../cipher-form-container";
import { CustomFieldsComponent } from "../custom-fields/custom-fields.component";

import { HTTPAuthenticationWarningDialogComponent } from "./http-authentication-warning-dialog.component";

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

  private autofillSettingsService = inject(AutofillSettingsServiceAbstraction);
  private dialogService = inject(DialogService);
  private platformUtilsService = inject(PlatformUtilsService);

  additionalOptionsForm = this.formBuilder.group({
    notes: [null as string],
    reprompt: [false],
    httpAuthentication: [false],
  });

  passwordRepromptEnabled$ = this.passwordRepromptService.enabled$.pipe(
    shareReplay({ refCount: false, bufferSize: 1 }),
  );

  /**
   * True in the browser extensions that answer HTTP authentication challenges: every browser
   * extension except Safari, which doesn't support them. Other clients store the setting with the
   * login but never act on it, so they don't show it.
   */
  private readonly clientAnswersHTTPAuthentication =
    this.platformUtilsService.getClientType() === ClientType.Browser &&
    !this.platformUtilsService.isSafari();

  /**
   * True when the HTTP authentication setting is shown: for logins, while HTTP authentication is
   * available, in a client that answers HTTP authentication challenges. The cipher-level controls are
   * also gated behind a dev flag until every cipher format saves the setting.
   */
  protected readonly showHTTPAuthenticationCipherSetting = toSignal(
    this.autofillSettingsService.httpAuthenticationAvailable$.pipe(
      map(
        (httpAuthenticationAvailable) =>
          httpAuthenticationAvailable &&
          this.clientAnswersHTTPAuthentication &&
          devFlagEnabled("httpAuthenticationCipherControls") &&
          this.cipherFormContainer.config.cipherType === CipherType.Login,
      ),
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

    this.additionalOptionsForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.cipherFormContainer.patchCipher((cipher) => {
        cipher.notes = value.notes;
        cipher.reprompt = value.reprompt ? CipherRepromptType.Password : CipherRepromptType.None;

        // Read from the control because a disabled control is left out of the form's `value`
        if (cipher.type === CipherType.Login && cipher.login != null) {
          cipher.login.httpAuthenticationEnabled =
            this.additionalOptionsForm.controls.httpAuthentication.value;
        }

        return cipher;
      });
    });
  }

  ngOnInit() {
    const prefillCipher = this.cipherFormContainer.getInitialCipherView();

    if (prefillCipher) {
      const reprompt = prefillCipher.reprompt === CipherRepromptType.Password;
      const httpAuthentication = prefillCipher.login?.httpAuthenticationEnabled === true;

      this.additionalOptionsForm.patchValue({
        notes: prefillCipher.notes,
        reprompt,
        httpAuthentication,
      });
    }

    if (this.cipherFormContainer.config.mode === "partial-edit") {
      this.additionalOptionsForm.disable();
      this.isPartialEdit = true;
    }
  }

  /**
   * Turning the HTTP authentication setting on always shows a warning first, and the checkbox stays
   * unchecked until the user confirms. Turning it off needs no confirmation.
   */
  protected async handleHTTPAuthenticationClick(event: Event) {
    const { httpAuthentication } = this.additionalOptionsForm.controls;

    if (httpAuthentication.value) {
      return;
    }

    // Keeps the checkbox from checking itself; the value is set only after the user confirms.
    event.preventDefault();

    const confirmed = await firstValueFrom(
      HTTPAuthenticationWarningDialogComponent.open(this.dialogService).closed,
    );

    if (confirmed === true) {
      httpAuthentication.setValue(true);
      httpAuthentication.markAsDirty();
    }
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
