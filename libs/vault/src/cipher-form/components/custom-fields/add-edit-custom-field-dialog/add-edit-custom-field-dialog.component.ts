// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Observable, Subject, map, of, switchMap, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType, FieldType, LinkedIdType } from "@bitwarden/common/vault/enums";
import {
  CustomFieldMetadata,
  VaultFilterMetadataService,
} from "@bitwarden/common/vault/filtering/vault-filter-metadata.service";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  FormFieldModule,
  IconButtonModule,
  SelectModule,
  ToggleGroupModule,
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
    ToggleGroupModule,
  ],
})
export class AddEditCustomFieldDialogComponent implements OnInit, OnDestroy {
  variant: "add" | "edit";

  customFieldForm = this.formBuilder.group({
    selectedExistingField: null as CustomFieldMetadata,
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

  protected selectExistingField = false;
  protected existingFields$: Observable<
    { name: string; type: FieldType; linkedType: LinkedIdType; count: number }[]
  >;
  private destroy$ = new Subject<void>();

  constructor(
    @Inject(DIALOG_DATA) private data: AddEditCustomFieldDialogData,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private AccountService: AccountService,
    private cipherService: CipherService,
    private vaultFilterMetadataService: VaultFilterMetadataService,
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

    this.existingFields$ = this.AccountService.activeAccount$.pipe(
      switchMap((account) => {
        if (!account) {
          return of([]);
        }
        return this.cipherService.cipherViews$(account.id);
      }),
      this.vaultFilterMetadataService.collectMetadata(),
      map((metadata) => metadata.customFields),
      map((customFields) => {
        return Array.from(customFields.entries()).map(([key, count]) => {
          const { name, type, linkedType } = key;
          return {
            name,
            type,
            linkedType,
            count,
          };
        });
      }),
    );
  }

  ngOnInit(): void {
    this.customFieldForm.controls.selectedExistingField.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((selectedExistingField) => {
        if (selectedExistingField) {
          this.customFieldForm.controls.label.setValue(selectedExistingField.name);
          this.customFieldForm.controls.type.setValue(selectedExistingField.type);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

  setSelectExistingField(existingField: boolean) {
    this.selectExistingField = existingField;
  }

  setFormValuesFromExistingField() {
    this.customFieldForm.controls.type.setValue(
      this.customFieldForm.controls.selectedExistingField.value.type,
    );
    this.customFieldForm.controls.label.setValue(
      this.customFieldForm.controls.selectedExistingField.value.name,
    );
  }
}
