// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, Input, OnInit, ViewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { shareReplay } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CipherRepromptType } from "@bitwarden/common/vault/enums";
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
import { CustomFieldsComponent } from "../custom-fields/custom-fields.component";

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
  @ViewChild(CustomFieldsComponent) customFieldsComponent: CustomFieldsComponent;

  additionalOptionsForm = this.formBuilder.group({
    notes: [null as string],
    reprompt: [false],
  });

  passwordRepromptEnabled$ = this.passwordRepromptService.enabled$.pipe(
    shareReplay({ refCount: false, bufferSize: 1 }),
  );

  /** When false when the add field button should be displayed in the Additional Options section  */
  hasCustomFields = false;

  /** True when the form is in `partial-edit` mode */
  isPartialEdit = false;

  @Input() disableSectionMargin: boolean;

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
        return cipher;
      });
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
