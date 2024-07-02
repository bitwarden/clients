import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { CipherFormContainer } from "../../cipher-form-container";

import { CardDetailsSectionComponent } from "./card-details-section.component";

describe("CardDetailsSectionComponent", () => {
  let component: CardDetailsSectionComponent;
  let fixture: ComponentFixture<CardDetailsSectionComponent>;
  let cipherFormProvider: MockProxy<CipherFormContainer>;
  let registerChildFormSpy: jest.SpyInstance;
  let patchCipherSpy: jest.SpyInstance;

  beforeEach(async () => {
    cipherFormProvider = mock<CipherFormContainer>();
    registerChildFormSpy = jest.spyOn(cipherFormProvider, "registerChildForm");
    patchCipherSpy = jest.spyOn(cipherFormProvider, "patchCipher");

    await TestBed.configureTestingModule({
      imports: [CardDetailsSectionComponent, CommonModule, ReactiveFormsModule],
      providers: [
        { provide: CipherFormContainer, useValue: cipherFormProvider },
        { provide: I18nService, useValue: mock<I18nService>() },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CardDetailsSectionComponent);
    component = fixture.componentInstance;
    component.cardDetailsForm.reset({
      cardholderName: null,
      number: null,
      brand: null,
      expMonth: null,
      expYear: null,
      code: null,
    });
    fixture.detectChanges();
  });

  it("registers `cardDetailsForm` with `CipherFormContainer`", () => {
    expect(registerChildFormSpy).toHaveBeenCalledWith("cardDetails", component.cardDetailsForm);
  });

  it("patches `cardDetailsForm` changes to cipherFormContainer", () => {
    component.cardDetailsForm.patchValue({
      cardholderName: "Ron Burgundy",
      number: "4242 4242 4242 4242",
    });

    const cardView = new CardView();
    cardView.cardholderName = "Ron Burgundy";
    cardView.number = "4242 4242 4242 4242";
    cardView.brand = "Visa";

    expect(patchCipherSpy).toHaveBeenCalledWith({
      card: cardView,
    });
  });

  it("it converts the year integer to a string", () => {
    component.cardDetailsForm.patchValue({
      expYear: 2022,
    });

    const cardView = new CardView();
    cardView.expYear = "2022";

    expect(patchCipherSpy).toHaveBeenCalledWith({
      card: cardView,
    });
  });

  it('disables `cardDetailsForm` when "disabled" is true', () => {
    component.disabled = true;

    component.ngOnInit();

    expect(component.cardDetailsForm.disabled).toBe(true);
  });

  it("initializes `cardDetailsForm` with current values", () => {
    const cardholderName = "Ron Burgundy";
    const number = "4242 4242 4242 4242";
    const code = "619";

    const cardView = new CardView();
    cardView.cardholderName = cardholderName;
    cardView.number = number;
    cardView.code = code;
    cardView.brand = "Visa";

    component.originalCipherView = {
      card: cardView,
    } as CipherView;

    component.ngOnInit();

    expect(component.cardDetailsForm.value).toEqual({
      cardholderName,
      number,
      code,
      brand: cardView.brand,
      expMonth: null,
      expYear: null,
    });
  });

  it("sets brand based on number changes", () => {
    const numberInput = fixture.debugElement.query(By.css('input[formControlName="number"]'));
    numberInput.nativeElement.value = "4111 1111 1111 1111";
    numberInput.nativeElement.dispatchEvent(new Event("input"));

    expect(component.cardDetailsForm.controls.brand.value).toBe("Visa");
  });
});
