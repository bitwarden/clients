import { SimpleChanges } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
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
});
