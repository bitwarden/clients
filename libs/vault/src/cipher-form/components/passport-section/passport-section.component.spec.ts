import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock } from "jest-mock-extended";
import { Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PassportView } from "@bitwarden/common/vault/models/view/passport.view";

import { CipherFormContainer } from "../../cipher-form-container";

import { PassportSectionComponent } from "./passport-section.component";

describe("PassportSectionComponent", () => {
  let fixture: ComponentFixture<PassportSectionComponent>;
  let component: PassportSectionComponent;
  const mockI18nService = mock<I18nService>();

  let formStatusChange$: Subject<string>;

  let cipherFormContainer: {
    registerChildForm: jest.Mock;
    patchCipher: jest.Mock;
    getInitialCipherView: jest.Mock;
    formStatusChange$: Subject<string>;
  };

  beforeEach(async () => {
    formStatusChange$ = new Subject<string>();

    cipherFormContainer = {
      registerChildForm: jest.fn(),
      patchCipher: jest.fn(),
      getInitialCipherView: jest.fn((): PassportView | null => null),
      formStatusChange$,
    };

    await TestBed.configureTestingModule({
      imports: [PassportSectionComponent, ReactiveFormsModule],
      providers: [
        { provide: CipherFormContainer, useValue: cipherFormContainer },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PassportSectionComponent);
    component = fixture.componentInstance;
  });

  describe("initialization", () => {
    it("registers passportDetails form with container", () => {
      expect(cipherFormContainer.registerChildForm).toHaveBeenCalledWith(
        "passportDetails",
        component.passportForm,
      );
    });

    it("does not set initial values when no passport data available", () => {
      fixture.detectChanges();
      expect(component.passportForm.getRawValue()).toEqual({
        surname: "",
        givenName: "",
        dateOfBirth: "",
        sex: "",
        birthPlace: "",
        nationality: "",
        issuingCountry: "",
        passportNumber: "",
        passportType: "",
        nationalIdentificationNumber: "",
        issuingAuthority: "",
        issueDate: "",
        expirationDate: "",
      });
    });

    it("sets initial values when passport data available", () => {
      const passportView = new PassportView();
      passportView.surname = "Doe";
      passportView.givenName = "John";
      passportView.passportNumber = "123456";

      cipherFormContainer.getInitialCipherView.mockReturnValue(null);

      fixture.componentRef.setInput("originalCipherView", {
        passport: passportView,
      } as CipherView);
      fixture.detectChanges();

      expect(component.passportForm.getRawValue().surname).toBe("Doe");
      expect(component.passportForm.getRawValue().givenName).toBe("John");
      expect(component.passportForm.getRawValue().passportNumber).toBe("123456");
    });

    it("disables form when disabled input is true", () => {
      fixture.componentRef.setInput("disabled", true);
      fixture.detectChanges();

      expect(fixture.componentInstance.passportForm.disabled).toBe(true);
    });
  });

  describe("form value changes", () => {
    it("patches cipher when form values change", () => {
      fixture.detectChanges();

      component.passportForm.patchValue({
        surname: "Smith",
        passportNumber: "P123456",
      });

      expect(cipherFormContainer.patchCipher).toHaveBeenCalled();
      const patchFn = cipherFormContainer.patchCipher.mock.calls[0][0];
      const mockCipher = { passport: null } as any;
      patchFn(mockCipher);

      expect(mockCipher.passport.surname).toBe("Smith");
      expect(mockCipher.passport.passportNumber).toBe("P123456");
    });
  });
});
