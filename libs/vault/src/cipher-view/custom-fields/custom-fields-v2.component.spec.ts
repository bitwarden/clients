import { SimpleChanges } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType, FieldType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { CustomFieldV2Component } from "./custom-fields-v2.component";

describe("CustomFieldV2Component", () => {
  let component: CustomFieldV2Component;
  let fixture: ComponentFixture<CustomFieldV2Component>;

  const currentCipher = new CipherView();
  currentCipher.type = CipherType.Login;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: EventCollectionService, useValue: mock<EventCollectionService>() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomFieldV2Component);
    component = fixture.componentInstance;
    component.cipher = currentCipher;
    fixture.detectChanges();
  });

  it("updates fieldOptions on cipher change", () => {
    component.ngOnChanges({
      cipher: {
        currentValue: currentCipher,
        previousValue: null,
        firstChange: true,
        isFirstChange: () => true,
      },
    } as SimpleChanges);

    expect(component.fieldOptions).toEqual(LoginView.prototype.linkedFieldOptions);

    const newCipher = new CipherView();
    newCipher.type = CipherType.Identity;

    component.cipher = newCipher;
    component.ngOnChanges({
      cipher: {
        currentValue: newCipher,
        previousValue: currentCipher,
        firstChange: false,
        isFirstChange: () => false,
      },
    } as SimpleChanges);
    fixture.detectChanges();

    expect(component.fieldOptions).toEqual(IdentityView.prototype.linkedFieldOptions);
  });

  it("uses a fixed-length mask for hidden field values", () => {
    const hiddenField = new FieldView();
    hiddenField.name = "API key";
    hiddenField.type = FieldType.Hidden;
    hiddenField.value = "a-value-with-a-variable-length";

    const cipher = new CipherView();
    cipher.type = CipherType.Login;
    cipher.viewPassword = false;
    cipher.fields = [hiddenField];
    component.cipher = cipher;
    fixture.detectChanges();

    const hiddenFieldInput = fixture.nativeElement.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;

    expect(hiddenFieldInput.value).toBe(hiddenField.maskedValue);
  });
});
