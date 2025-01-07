// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType, FieldType } from "@bitwarden/common/vault/enums";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  FormFieldModule,
  IconButtonModule,
  SelectModule,
} from "@bitwarden/components";

export type AddEditCustomFieldDialogData = {
  addField: (type: FieldType, label: string) => void;
  updateLabel: (index: number, label: string) => void;
  removeField: (index: number) => void;
  /** Type of cipher */
  cipherType: CipherType;
  /** When provided, dialog will display edit label variants */
  editLabelConfig?: { index: number; label: string };
};

@Component({
  standalone: true,
  selector: "vault-add-edit-custom-field-dialog",
  templateUrl: "./add-edit-custom-field-dialog.component.html",
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    ButtonModule,
    FormFieldModule,
    SelectModule,
    ReactiveFormsModule,
    IconButtonModule,
    AsyncActionsModule,
  ],
})
export class AddEditCustomFieldDialogComponent {
  variant: "add" | "edit";

  customFieldForm = this.formBuilder.group({
    type: FieldType.Text,
    label: ["", Validators.required],
  });

  fieldTypeOptions = [
    { name: this.i18nService.t("cfTypeText"), value: FieldType.Text },
    { name: this.i18nService.t("cfTypeHidden"), value: FieldType.Hidden },
    { name: this.i18nService.t("cfTypeCheckbox"), value: FieldType.Boolean },
    { name: this.i18nService.t("cfTypeLinked"), value: FieldType.Linked },
  ];

  FieldType = FieldType;

  constructor(
    @Inject(DIALOG_DATA) private data: AddEditCustomFieldDialogData,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
  ) {
    this.variant = data.editLabelConfig ? "edit" : "add";

    this.fieldTypeOptions = this.fieldTypeOptions.filter((option) => {
      // Filter out the Linked field type for Secure Notes
      if (this.data.cipherType === CipherType.SecureNote) {
        return option.value !== FieldType.Linked;
      }

      return true;
    });

    if (this.variant === "edit") {
      this.customFieldForm.controls.label.setValue(data.editLabelConfig.label);
      this.customFieldForm.controls.type.disable();
    }
  }

  getTypeHint(): string {
    switch (this.customFieldForm.get("type")?.value) {
      case FieldType.Text:
        return this.i18nService.t("textHelpText");
      case FieldType.Hidden:
        return this.i18nService.t("hiddenHelpText");
      case FieldType.Boolean:
        return this.i18nService.t("checkBoxHelpText");
      case FieldType.Linked:
        return this.i18nService.t("linkedHelpText");
      default:
        return "";
    }
  }

  /** Direct the form submission to the proper action */
  submit = () => {
    if (this.variant === "add") {
      this.addField();
    } else {
      this.updateLabel();
    }
  };

  /** Invoke the `addField` callback with the custom field details */
  addField() {
    if (this.customFieldForm.invalid) {
      return;
    }

    const { type, label } = this.customFieldForm.value;
    this.data.addField(type, label);
  }

  /** Invoke the `updateLabel` callback with the new label */
  updateLabel() {
    if (this.customFieldForm.invalid) {
      return;
    }

    const { label } = this.customFieldForm.value;
    this.data.updateLabel(this.data.editLabelConfig.index, label);
  }

  /** Invoke the `removeField` callback */
  removeField() {
    this.data.removeField(this.data.editLabelConfig.index);
  }
}
