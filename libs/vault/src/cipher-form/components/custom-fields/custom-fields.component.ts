// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { CdkDragDrop, DragDropModule, moveItemInArray } from "@angular/cdk/drag-drop";
import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
  QueryList,
  ViewChildren,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormArray, FormBuilder, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { Subject, zip } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { EventType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType, FieldType, LinkedIdType } from "@bitwarden/common/vault/enums";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import {
  DialogRef,
  CardComponent,
  CheckboxModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  LinkModule,
  SectionHeaderComponent,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";

import { CipherFormContainer } from "../../cipher-form-container";

import {
  AddEditCustomFieldDialogComponent,
  AddEditCustomFieldDialogData,
} from "./add-edit-custom-field-dialog/add-edit-custom-field-dialog.component";

/** Attributes associated with each individual FormGroup within the FormArray */
export type CustomField = {
  type: FieldType;
  name: string;
  value: string | boolean | null;
  linkedId: LinkedIdType;
  /**
   * `newField` is set to true when the custom field is created.
   *
   * This is applicable when the user is adding a new field but
   * the `viewPassword` property on the cipher is false. The
   * user will still need the ability to set the value of the field
   * they just created.
   *
   * See {@link CustomFieldsComponent.canViewPasswords} for implementation.
   */
  newField: boolean;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-custom-fields",
  templateUrl: "./custom-fields.component.html",
  imports: [
    JslibModule,
    CommonModule,
    FormsModule,
    FormFieldModule,
    ReactiveFormsModule,
    SectionHeaderComponent,
    TypographyModule,
    CardComponent,
    IconButtonModule,
    CheckboxModule,
    SelectModule,
    DragDropModule,
    LinkModule,
  ],
})
export class CustomFieldsComponent implements OnInit, AfterViewInit {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() numberOfFieldsChange = new EventEmitter<number>();

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChildren("customFieldRow") customFieldRows: QueryList<ElementRef<HTMLDivElement>>;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() disableSectionMargin: boolean;

  customFieldsForm = this.formBuilder.group({
    fields: new FormArray([]),
  });

  /** Reference to the add field dialog */
  dialogRef: DialogRef;

  /** Options for Linked Fields */
  linkedFieldOptions: { name: string; value: LinkedIdType }[] = [];

  /** True when edit/reorder toggles should be hidden based on partial-edit */
  isPartialEdit: boolean;

  /** True when there are custom fields available */
  hasCustomFields = false;

  /** Emits when a new custom field should be focused */
  private focusOnNewInput$ = new Subject<void>();

  /** Tracks the disabled status of the edit cipher form */
  protected parentFormDisabled: boolean = false;

  disallowHiddenField?: boolean;

  destroyed$: DestroyRef;
  FieldType = FieldType;

  constructor(
    private dialogService: DialogService,
    private cipherFormContainer: CipherFormContainer,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private liveAnnouncer: LiveAnnouncer,
    private eventCollectionService: EventCollectionService,
  ) {
    this.destroyed$ = inject(DestroyRef);
    this.cipherFormContainer.registerChildForm("customFields", this.customFieldsForm);

    this.customFieldsForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      // getRawValue ensures disabled fields are included
      this.updateCipher(this.fields.getRawValue());
    });

    this.cipherFormContainer.formStatusChange$.pipe(takeUntilDestroyed()).subscribe((status) => {
      this.parentFormDisabled = status === "disabled";
    });
  }

  /** Fields form array, referenced via a getter to avoid type-casting in multiple places  */
  get fields(): FormArray {
    return this.customFieldsForm.controls.fields as FormArray;
  }

  canEdit(type: FieldType): boolean {
    return (
      !this.isPartialEdit &&
      (type !== FieldType.Hidden ||
        this.cipherFormContainer.originalCipherView === null ||
        this.cipherFormContainer.originalCipherView.viewPassword)
    );
  }

  ngOnInit() {
    const linkedFieldsOptionsForCipher = this.getLinkedFieldsOptionsForCipher();
    const optionsArray = Array.from(linkedFieldsOptionsForCipher?.entries() ?? []);
    optionsArray.sort((a, b) => a[1].sortPosition - b[1].sortPosition);

    // Populate options for linked custom fields
    this.linkedFieldOptions = optionsArray.map(([id, linkedFieldOption]) => ({
      name: this.i18nService.t(linkedFieldOption.i18nKey),
      value: id as LinkedIdType,
    }));

    const prefillCipher = this.cipherFormContainer.getInitialCipherView();

    // When available, populate the form with the existing fields
    prefillCipher?.fields?.forEach((field) => {
      let value: string | boolean = field.value;

      if (field.type === FieldType.Boolean) {
        value = field.value === "true" ? true : false;
      }

      const customField = this.formBuilder.group<CustomField>({
        type: field.type,
        name: field.name,
        value: value,
        linkedId: field.linkedId,
        newField: false,
      });

      if (
        field.type === FieldType.Hidden &&
        !this.cipherFormContainer.originalCipherView?.viewPassword
      ) {
        customField.controls.value.disable();
      }

      this.fields.push(customField);
    });

    // Disable the form if in partial-edit mode
    // Must happen after the initial fields are populated
    if (this.cipherFormContainer.config.mode === "partial-edit") {
      this.isPartialEdit = true;
      this.customFieldsForm.disable();
    }
  }

  ngAfterViewInit(): void {
    // Focus on the new input field when it is added
    // This is done after the view is initialized to ensure the input is rendered
    zip(this.focusOnNewInput$, this.customFieldRows.changes)
      .pipe(takeUntilDestroyed(this.destroyed$))
      .subscribe(() => {
        const mostRecentRow = this.customFieldRows.last.nativeElement;
        const input = mostRecentRow.querySelector<HTMLInputElement>("input");
        const label = mostRecentRow.querySelector<HTMLLabelElement>("label").textContent.trim();

        // Focus the input after the announcement element is added to the DOM,
        // this should stop the announcement from being cut off by the "focus" event.
        void this.liveAnnouncer
          .announce(this.i18nService.t("fieldAdded", label), "polite")
          .then(() => {
            input.focus();
          });
      });
  }

  /** Opens the add/edit custom field dialog */
  openAddEditCustomFieldDialog(editLabelConfig?: AddEditCustomFieldDialogData["editLabelConfig"]) {
    const { cipherType, mode, originalCipher } = this.cipherFormContainer.config;
    this.dialogRef = this.dialogService.open<unknown, AddEditCustomFieldDialogData>(
      AddEditCustomFieldDialogComponent,
      {
        data: {
          addField: this.addField.bind(this),
          updateLabel: this.updateLabel.bind(this),
          removeField: this.removeField.bind(this),
          cipherType,
          editLabelConfig,
          disallowHiddenField: mode === "edit" && !originalCipher.viewPassword,
        },
      },
    );
  }

  /** Returns true when the user has permission to view passwords for the individual cipher */
  canViewPasswords(index: number) {
    if (this.cipherFormContainer.originalCipherView === null) {
      return true;
    }

    return (
      this.cipherFormContainer.originalCipherView.viewPassword ||
      this.fields.at(index).value.newField
    );
  }

  /** Updates label for an individual field */
  updateLabel(index: number, label: string) {
    this.fields.at(index).patchValue({ name: label });
    this.dialogRef?.close();
  }

  /** Removes an individual field at a specific index */
  removeField(index: number) {
    this.fields.removeAt(index);
    this.dialogRef?.close();
  }

  /** Adds a new field to the form */
  addField(type: FieldType, label: string) {
    this.dialogRef?.close();

    let value = null;
    let linkedId = null;

    if (type === FieldType.Boolean) {
      // Default to false for boolean fields
      value = false;
    }

    if (type === FieldType.Linked && this.linkedFieldOptions.length > 0) {
      // Default to the first linked field option
      linkedId = this.linkedFieldOptions[0].value;
    }

    this.fields.push(
      this.formBuilder.group<CustomField>({
        type,
        name: label,
        value,
        linkedId,
        newField: true,
      }),
    );

    // Trigger focus on the new input field
    this.focusOnNewInput$.next();
  }

  /** Reorder the controls to match the new order after a "drop" event */
  drop(event: CdkDragDrop<HTMLDivElement>) {
    // Alter the order of the fields array in place
    moveItemInArray(this.fields.controls, event.previousIndex, event.currentIndex);

    this.updateCipher(this.fields.controls.map((control) => control.value));
  }

  /** Move a custom field up or down in the list order */
  async handleKeyDown(event: KeyboardEvent, label: string, index: number) {
    if (event.key === "ArrowUp" && index !== 0) {
      event.preventDefault();

      const currentIndex = index - 1;
      this.drop({ previousIndex: index, currentIndex } as CdkDragDrop<HTMLDivElement>);
      await this.liveAnnouncer.announce(
        this.i18nService.t("reorderFieldUp", label, currentIndex + 1, this.fields.length),
        "assertive",
      );

      // Refocus the button after the reorder
      // Angular re-renders the list when moving an item up which causes the focus to be lost
      // Wait for the next tick to ensure the button is rendered before focusing
      setTimeout(() => {
        (event.target as HTMLButtonElement).focus();
      });
    }

    if (event.key === "ArrowDown" && index !== this.fields.length - 1) {
      event.preventDefault();

      const currentIndex = index + 1;
      this.drop({ previousIndex: index, currentIndex } as CdkDragDrop<HTMLDivElement>);
      await this.liveAnnouncer.announce(
        this.i18nService.t("reorderFieldDown", label, currentIndex + 1, this.fields.length),
        "assertive",
      );
    }
  }

  async logHiddenEvent(hiddenFieldVisible: boolean) {
    const { mode, originalCipher } = this.cipherFormContainer.config;

    const isEdit = ["edit", "partial-edit"].includes(mode);

    if (hiddenFieldVisible && isEdit) {
      await this.eventCollectionService.collect(
        EventType.Cipher_ClientToggledHiddenFieldVisible,
        originalCipher.id,
        false,
        originalCipher.organizationId,
      );
    }
  }

  /**
   * Returns the linked field options for the current cipher type
   *
   * Note: Note ciphers do not have linked fields
   */
  private getLinkedFieldsOptionsForCipher() {
    switch (this.cipherFormContainer.config.cipherType) {
      case CipherType.Login:
        return LoginView.prototype.linkedFieldOptions;
      case CipherType.Card:
        return CardView.prototype.linkedFieldOptions;
      case CipherType.Identity:
        return IdentityView.prototype.linkedFieldOptions;
      default:
        return null;
    }
  }

  /** Create `FieldView` from the form objects and update the cipher */
  private updateCipher(fields: CustomField[]) {
    const newFields = fields.map((field: CustomField) => {
      let value: string;

      if (typeof field.value === "number") {
        value = `${field.value}`;
      } else if (typeof field.value === "boolean") {
        value = field.value ? "true" : "false";
      } else {
        value = field.value;
      }

      const fieldView = new FieldView();
      fieldView.type = field.type;
      fieldView.name = field.name;
      fieldView.value = value;
      fieldView.linkedId = field.linkedId ?? undefined;
      return fieldView;
    });

    this.hasCustomFields = newFields.length > 0;

    this.numberOfFieldsChange.emit(newFields.length);

    this.cipherFormContainer.patchCipher((cipher) => {
      cipher.fields = newFields;
      return cipher;
    });
  }
}
