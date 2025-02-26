import { LiveAnnouncer } from "@angular/cdk/a11y";
import { DialogRef } from "@angular/cdk/dialog";
import { CdkDragDrop } from "@angular/cdk/drag-drop";
import { DebugElement } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  CardLinkedId,
  CipherType,
  FieldType,
  IdentityLinkedId,
  LoginLinkedId,
} from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { BitPasswordInputToggleDirective, DialogService } from "@bitwarden/components";

import { CipherFormConfig } from "../../abstractions/cipher-form-config.service";
import { CipherFormContainer } from "../../cipher-form-container";

import { CustomField, CustomFieldsComponent } from "./custom-fields.component";

const mockFieldViews = [
  { type: FieldType.Text, name: "text label", value: "text value" },
  { type: FieldType.Hidden, name: "hidden label", value: "hidden value" },
  { type: FieldType.Boolean, name: "boolean label", value: "true" },
  { type: FieldType.Linked, name: "linked label", value: null, linkedId: 1 },
] as FieldView[];

let originalCipherView: CipherView | null = new CipherView();

describe("CustomFieldsComponent", () => {
  let component: CustomFieldsComponent;
  let fixture: ComponentFixture<CustomFieldsComponent>;
  let open: jest.Mock;
  let announce: jest.Mock;
  let patchCipher: jest.Mock;
  let config: CipherFormConfig;

  beforeEach(async () => {
    open = jest.fn();
    announce = jest.fn().mockResolvedValue(null);
    patchCipher = jest.fn();
    originalCipherView = new CipherView();
    config = {} as CipherFormConfig;

    await TestBed.configureTestingModule({
      imports: [CustomFieldsComponent],
      providers: [
        { provide: EventCollectionService, useValue: mock<EventCollectionService>() },
        {
          provide: I18nService,
          useValue: { t: (...keys: string[]) => keys.filter(Boolean).join(" ") },
        },
        {
          provide: CipherFormContainer,
          useValue: {
            patchCipher,
            originalCipherView,
            registerChildForm: jest.fn(),
            config,
            getInitialCipherView: jest.fn(() => originalCipherView),
          },
        },
        {
          provide: LiveAnnouncer,
          useValue: { announce },
        },
      ],
    })
      .overrideProvider(DialogService, {
        useValue: {
          open,
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CustomFieldsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe("initializing", () => {
    it("populates customFieldsForm", () => {
      originalCipherView.fields = mockFieldViews;

      component.ngOnInit();

      expect(component.fields.value).toEqual([
        {
          linkedId: null,
          name: "text label",
          type: FieldType.Text,
          value: "text value",
          newField: false,
        },
        {
          linkedId: null,
          name: "hidden label",
          type: FieldType.Hidden,
          value: "hidden value",
          newField: false,
        },
        {
          linkedId: null,
          name: "boolean label",
          type: FieldType.Boolean,
          value: true,
          newField: false,
        },
        {
          linkedId: 1,
          name: "linked label",
          type: FieldType.Linked,
          value: null,
          newField: false,
        },
      ]);
    });

    it("when `viewPassword` is false the user cannot see the view toggle option", () => {
      originalCipherView.viewPassword = false;
      originalCipherView.fields = mockFieldViews;

      component.ngOnInit();

      fixture.detectChanges();

      const button = fixture.debugElement.query(By.directive(BitPasswordInputToggleDirective));

      expect(button).toBeFalsy();
    });

    it("should disable the hidden field input when `viewPassword` is false", () => {
      originalCipherView.viewPassword = false;
      originalCipherView.fields = mockFieldViews;

      component.ngOnInit();

      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('[data-testid="custom-hidden-field"]'));

      expect(input.nativeElement.disabled).toBe(true);
    });

    it("when `viewPassword` is true the user can see the view toggle option", () => {
      originalCipherView.viewPassword = true;
      originalCipherView.fields = mockFieldViews;

      component.ngOnInit();

      fixture.detectChanges();

      const button = fixture.debugElement.query(By.directive(BitPasswordInputToggleDirective));

      expect(button).toBeTruthy();
    });

    describe("linkedFieldOptions", () => {
      /** Retrieve the numerical values of an enum object */
      const getEnumValues = (enumType: object) =>
        Object.values(enumType).filter((v) => typeof v === "number");

      it("populates for login ciphers", () => {
        config.cipherType = CipherType.Login;

        component.ngOnInit();

        expect(component.linkedFieldOptions.map((o) => o.value)).toEqual(
          expect.arrayContaining(getEnumValues(LoginLinkedId)),
        );
      });

      it("populates for card ciphers", () => {
        config.cipherType = CipherType.Card;

        component.ngOnInit();

        expect(component.linkedFieldOptions.map((o) => o.value)).toEqual(
          expect.arrayContaining(getEnumValues(CardLinkedId)),
        );
      });

      it("populates for identity ciphers", () => {
        config.cipherType = CipherType.Identity;

        component.ngOnInit();

        expect(component.linkedFieldOptions.map((o) => o.value)).toEqual(
          expect.arrayContaining(getEnumValues(IdentityLinkedId)),
        );
      });

      it("sets an empty array for note ciphers", () => {
        config.cipherType = CipherType.SecureNote;

        component.ngOnInit();

        expect(component.linkedFieldOptions).toEqual([]);
      });
    });
  });

  describe("adding new field", () => {
    let close: jest.Mock;

    beforeEach(() => {
      close = jest.fn();
      component.dialogRef = { close } as unknown as DialogRef;
    });

    it("closes the add dialog", () => {
      component.addField(FieldType.Text, "test label");

      expect(close).toHaveBeenCalled();
    });

    it("adds a unselected boolean field", () => {
      component.addField(FieldType.Boolean, "bool label");

      expect(component.fields.value).toEqual([
        {
          linkedId: null,
          name: "bool label",
          type: FieldType.Boolean,
          value: false,
          newField: true,
        },
      ]);
    });

    it("auto-selects the first linked field option", () => {
      component.linkedFieldOptions = [
        { value: LoginLinkedId.Password, name: "one" },
        { value: LoginLinkedId.Username, name: "two" },
      ];

      component.addField(FieldType.Linked, "linked label");

      expect(component.fields.value).toEqual([
        {
          linkedId: LoginLinkedId.Password,
          name: "linked label",
          type: FieldType.Linked,
          value: null,
          newField: true,
        },
      ]);
    });

    it("adds text field", () => {
      component.addField(FieldType.Text, "text label");

      expect(component.fields.value).toEqual([
        { linkedId: null, name: "text label", type: FieldType.Text, value: null, newField: true },
      ]);
    });

    it("adds hidden field", () => {
      component.addField(FieldType.Hidden, "hidden label");

      expect(component.fields.value).toEqual([
        {
          linkedId: null,
          name: "hidden label",
          type: FieldType.Hidden,
          value: null,
          newField: true,
        },
      ]);
    });

    it("announces the new input field", () => {
      component.addField(FieldType.Text, "text label 2");

      fixture.detectChanges();

      expect(announce).toHaveBeenCalledWith("fieldAdded text label 2", "polite");
    });

    it("allows a user to view hidden fields when the cipher `viewPassword` is false", () => {
      originalCipherView.viewPassword = false;
      component.addField(FieldType.Hidden, "Hidden label");

      fixture.detectChanges();

      const button = fixture.debugElement.query(By.directive(BitPasswordInputToggleDirective));

      expect(button.nativeElement.disabled).toBe(false);
    });
  });

  describe("updating a field", () => {
    beforeEach(() => {
      originalCipherView.fields = [mockFieldViews[0]];

      component.ngOnInit();
    });

    it("updates the value", () => {
      component.fields.at(0).patchValue({ value: "new text value" });

      const fieldView = new FieldView();
      fieldView.name = "text label";
      fieldView.value = "new text value";
      fieldView.type = FieldType.Text;

      expect(patchCipher).toHaveBeenCalled();
      const patchFn = patchCipher.mock.lastCall[0];

      const updatedCipher = patchFn(new CipherView());
      expect(updatedCipher.fields).toEqual([fieldView]);
    });

    it("updates the label", () => {
      component.updateLabel(0, "new text label");

      const fieldView = new FieldView();
      fieldView.name = "new text label";
      fieldView.value = "text value";
      fieldView.type = FieldType.Text;

      expect(patchCipher).toHaveBeenCalled();
      const patchFn = patchCipher.mock.lastCall[0];

      const updatedCipher = patchFn(new CipherView());
      expect(updatedCipher.fields).toEqual([fieldView]);
    });
  });

  describe("removing field", () => {
    beforeEach(() => {
      originalCipherView.fields = [mockFieldViews[0]];

      component.ngOnInit();
    });

    it("removes the field", () => {
      component.removeField(0);

      expect(patchCipher).toHaveBeenCalled();
      const patchFn = patchCipher.mock.lastCall[0];

      const updatedCipher = patchFn(new CipherView());
      expect(updatedCipher.fields).toEqual([]);
    });
  });

  describe("reordering fields", () => {
    let toggleItems: DebugElement[];

    beforeEach(() => {
      originalCipherView.fields = mockFieldViews;

      component.ngOnInit();

      fixture.detectChanges();

      toggleItems = fixture.debugElement.queryAll(
        By.css('button[data-testid="reorder-toggle-button"]'),
      );
    });

    it("reorders the fields when dropped", () => {
      expect(component.fields.value.map((f: CustomField) => f.name)).toEqual([
        "text label",
        "hidden label",
        "boolean label",
        "linked label",
      ]);

      // Move second field to first
      component.drop({ previousIndex: 0, currentIndex: 1 } as CdkDragDrop<HTMLDivElement>);

      expect(patchCipher).toHaveBeenCalled();
      const patchFn = patchCipher.mock.lastCall[0];

      const updatedCipher = patchFn(new CipherView());

      expect(updatedCipher.fields.map((f: FieldView) => f.name)).toEqual([
        "hidden label",
        "text label",
        "boolean label",
        "linked label",
      ]);
    });

    it("moves an item down in order via keyboard", () => {
      // Move 3rd item (boolean label) down to 4th
      toggleItems[2].triggerEventHandler("keydown", {
        key: "ArrowDown",
        preventDefault: jest.fn(),
      });

      expect(patchCipher).toHaveBeenCalled();
      const patchFn = patchCipher.mock.lastCall[0];

      const updatedCipher = patchFn(new CipherView());

      expect(updatedCipher.fields.map((f: FieldView) => f.name)).toEqual([
        "text label",
        "hidden label",
        "linked label",
        "boolean label",
      ]);
    });

    it("moves an item up in order via keyboard", () => {
      // Move 2nd item (hidden label) up to 1st
      toggleItems[1].triggerEventHandler("keydown", { key: "ArrowUp", preventDefault: jest.fn() });

      expect(patchCipher).toHaveBeenCalled();
      const patchFn = patchCipher.mock.lastCall[0];

      const updatedCipher = patchFn(new CipherView());

      expect(updatedCipher.fields.map((f: FieldView) => f.name)).toEqual([
        "hidden label",
        "text label",
        "boolean label",
        "linked label",
      ]);
    });

    it("does not move the first item up", () => {
      patchCipher.mockClear();

      toggleItems[0].triggerEventHandler("keydown", { key: "ArrowUp", preventDefault: jest.fn() });

      expect(patchCipher).not.toHaveBeenCalled();
    });

    it("does not move the last item down", () => {
      patchCipher.mockClear();

      toggleItems[toggleItems.length - 1].triggerEventHandler("keydown", {
        key: "ArrowDown",
        preventDefault: jest.fn(),
      });

      expect(patchCipher).not.toHaveBeenCalled();
    });

    it("announces the reorder up", () => {
      // Move 2nd item up to 1st
      toggleItems[1].triggerEventHandler("keydown", { key: "ArrowUp", preventDefault: jest.fn() });

      // "reorder hidden label to position 1 of 4"
      expect(announce).toHaveBeenCalledWith("reorderFieldUp hidden label 1 4", "assertive");
    });

    it("announces the reorder down", () => {
      // Move 3rd item down to 4th
      toggleItems[2].triggerEventHandler("keydown", {
        key: "ArrowDown",
        preventDefault: jest.fn(),
      });

      // "reorder boolean label to position 4 of 4"
      expect(announce).toHaveBeenCalledWith("reorderFieldDown boolean label 4 4", "assertive");
    });
  });
});
