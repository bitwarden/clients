import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType, FieldType } from "@bitwarden/common/vault/enums";
import { DIALOG_DATA } from "@bitwarden/components";

import {
  AddEditCustomFieldDialogComponent,
  AddEditCustomFieldDialogData,
} from "./add-edit-custom-field-dialog.component";

describe("AddEditCustomFieldDialogComponent", () => {
  let component: AddEditCustomFieldDialogComponent;
  let fixture: ComponentFixture<AddEditCustomFieldDialogComponent>;
  const addField = jest.fn();
  const updateLabel = jest.fn();
  const removeField = jest.fn();

  const dialogData = {
    addField,
    updateLabel,
    removeField,
    cipherType: CipherType.Login,
  } as AddEditCustomFieldDialogData;

  beforeEach(async () => {
    addField.mockClear();
    updateLabel.mockClear();
    removeField.mockClear();

    await TestBed.configureTestingModule({
      imports: [AddEditCustomFieldDialogComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: DIALOG_DATA, useValue: dialogData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddEditCustomFieldDialogComponent);
    component = fixture.componentInstance;
    // FIXME: Remove when updating file. Eslint update
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    fixture.detectChanges;
  });

  it("creates", () => {
    expect(component).toBeTruthy();
  });

  it("calls `addField` from DIALOG_DATA on with the type and label", () => {
    component.customFieldForm.setValue({ type: FieldType.Text, label: "Test Label" });

    component.submit();

    expect(addField).toHaveBeenCalledWith(FieldType.Text, "Test Label");
  });

  it("calls `updateLabel` from DIALOG_DATA with the new label", () => {
    component.variant = "edit";
    dialogData.editLabelConfig = { index: 0, label: "Test Label" };
    component.customFieldForm.setValue({ type: FieldType.Text, label: "Test Label 2" });

    component.submit();

    expect(updateLabel).toHaveBeenCalledWith(0, "Test Label 2");
  });

  it("calls `removeField` from DIALOG_DATA with the respective index", () => {
    dialogData.editLabelConfig = { index: 2, label: "Test Label" };

    component.removeField();

    expect(removeField).toHaveBeenCalledWith(2);
  });

  it('filters out "Linked" field type for SecureNote cipher type', () => {
    dialogData.cipherType = CipherType.SecureNote;

    fixture = TestBed.createComponent(AddEditCustomFieldDialogComponent);
    component = fixture.componentInstance;

    expect(component.fieldTypeOptions).not.toContainEqual(
      expect.objectContaining({ value: FieldType.Linked }),
    );
  });

  it("does not filter out 'Hidden' field type when 'disallowHiddenField' is false", () => {
    dialogData.disallowHiddenField = false;
    fixture = TestBed.createComponent(AddEditCustomFieldDialogComponent);
    component = fixture.componentInstance;

    expect(component.fieldTypeOptions).toContainEqual(
      expect.objectContaining({ value: FieldType.Hidden }),
    );
  });

  it("filers out 'Hidden' field type when 'disallowHiddenField' is true", () => {
    dialogData.disallowHiddenField = true;
    fixture = TestBed.createComponent(AddEditCustomFieldDialogComponent);
    component = fixture.componentInstance;

    expect(component.fieldTypeOptions).not.toContainEqual(
      expect.objectContaining({ value: FieldType.Hidden }),
    );
  });
});
