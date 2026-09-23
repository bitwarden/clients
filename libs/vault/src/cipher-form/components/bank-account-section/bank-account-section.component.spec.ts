import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";
import { Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { BankAccountView } from "@bitwarden/common/vault/models/view/bank-account.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { CipherFormContainer } from "../../cipher-form-container";

import { BankAccountSectionComponent } from "./bank-account-section.component";

describe("BankAccountSectionComponent", () => {
  let component: BankAccountSectionComponent;
  let fixture: ComponentFixture<BankAccountSectionComponent>;
  let cipherFormProvider: MockProxy<CipherFormContainer>;
  let registerChildFormSpy: jest.SpyInstance;
  let patchCipherSpy: jest.SpyInstance;
  let formStatusChange$: Subject<"enabled" | "disabled">;

  const getInitialCipherView = jest.fn((): any => null);

  beforeEach(async () => {
    formStatusChange$ = new Subject<"enabled" | "disabled">();
    cipherFormProvider = mock<CipherFormContainer>({ getInitialCipherView, formStatusChange$ });
    registerChildFormSpy = jest.spyOn(cipherFormProvider, "registerChildForm");
    patchCipherSpy = jest.spyOn(cipherFormProvider, "patchCipher");

    await TestBed.configureTestingModule({
      imports: [BankAccountSectionComponent, CommonModule, ReactiveFormsModule],
      providers: [
        { provide: CipherFormContainer, useValue: cipherFormProvider },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BankAccountSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("registers `bankAccountForm` with `CipherFormContainer`", () => {
    expect(registerChildFormSpy).toHaveBeenCalledWith(
      "bankAccountDetails",
      component.bankAccountForm,
    );
  });

  it("patches `bankAccountForm` changes to cipherFormContainer", () => {
    component.bankAccountForm.patchValue({ bankName: "First National" });

    expect(patchCipherSpy).toHaveBeenCalled();
    const patchFn = patchCipherSpy.mock.lastCall[0];
    const updatedCipher = patchFn(new CipherView());
    expect(updatedCipher.bankAccount?.bankName).toBe("First National");
  });

  it("initializes `bankAccountForm` from `getInitialCipherView`", () => {
    const bankAccountView = new BankAccountView();
    bankAccountView.bankName = "First National";
    bankAccountView.pin = "1234";

    getInitialCipherView.mockReturnValueOnce({ bankAccount: bankAccountView });

    component.ngOnInit();

    expect(component.bankAccountForm.value.bankName).toBe("First National");
    expect(component.bankAccountForm.value.pin).toBe("1234");
  });

  describe("PIN numeric filter", () => {
    it("strips non-numeric characters from PIN", () => {
      component.bankAccountForm.controls.pin.setValue("abc123$!");

      expect(component.bankAccountForm.controls.pin.value).toBe("123");
    });

    it("leaves numeric-only PIN unchanged", () => {
      component.bankAccountForm.controls.pin.setValue("1234");

      expect(component.bankAccountForm.controls.pin.value).toBe("1234");
    });

    it("does not alter an empty PIN", () => {
      component.bankAccountForm.controls.pin.setValue("");

      expect(component.bankAccountForm.controls.pin.value).toBe("");
    });

    it("strips all characters when PIN has no digits", () => {
      component.bankAccountForm.controls.pin.setValue("abcd$!");

      expect(component.bankAccountForm.controls.pin.value).toBe("");
    });
  });
});
