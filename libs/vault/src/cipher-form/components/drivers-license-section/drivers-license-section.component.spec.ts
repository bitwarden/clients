import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { AbstractControl, ReactiveFormsModule } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DriversLicenseView } from "@bitwarden/common/vault/models/view/drivers-license.view";

import { CipherFormContainer } from "../../cipher-form-container";

import { DriversLicenseSectionComponent } from "./drivers-license-section.component";

describe("DriversLicenseSectionComponent", () => {
  let component: DriversLicenseSectionComponent;
  let fixture: ComponentFixture<DriversLicenseSectionComponent>;
  let cipherFormProvider: MockProxy<CipherFormContainer>;
  let patchCipherSpy: jest.SpyInstance;

  const getInitialCipherView = jest.fn((): any => null);

  beforeEach(async () => {
    cipherFormProvider = mock<CipherFormContainer>({ getInitialCipherView });
    patchCipherSpy = jest.spyOn(cipherFormProvider, "patchCipher");

    await TestBed.configureTestingModule({
      imports: [DriversLicenseSectionComponent, CommonModule, ReactiveFormsModule],
      providers: [
        { provide: CipherFormContainer, useValue: cipherFormProvider },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DriversLicenseSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** Helper to get a control by dot-separated path. */
  function ctrl(path: string): AbstractControl {
    return component.driversLicenseForm.get(path)!;
  }

  it("patches form changes to cipherFormContainer", () => {
    component.driversLicenseForm.patchValue({
      licenseNumber: "D1234567",
      firstName: "Jane",
      lastName: "Doe",
    });

    expect(patchCipherSpy).toHaveBeenCalled();
    const patchFn = patchCipherSpy.mock.calls[0][0];
    const cipher = new CipherView();
    cipher.driversLicense = new DriversLicenseView();
    const result = patchFn(cipher);
    expect(result.driversLicense.licenseNumber).toBe("D1234567");
    expect(result.driversLicense.firstName).toBe("Jane");
    expect(result.driversLicense.lastName).toBe("Doe");
  });

  it("populates form from existing cipher on init", () => {
    const existing = new DriversLicenseView();
    existing.licenseNumber = "X9876543";
    existing.firstName = "John";
    existing.issuingState = "CA";

    const cipherView = new CipherView();
    cipherView.driversLicense = existing;
    getInitialCipherView.mockReturnValueOnce(cipherView);

    component.ngOnInit();

    expect(component.driversLicenseForm.value.licenseNumber).toBe("X9876543");
    expect(component.driversLicenseForm.value.firstName).toBe("John");
    expect(component.driversLicenseForm.value.issuingState).toBe("CA");
  });

  describe("date form integration", () => {
    it("stores a YYYY-MM-DD date string from DateFieldGroupComponent", () => {
      ctrl("dateOfBirth").setValue("2025-04-15");

      const patchFn = patchCipherSpy.mock.calls[0][0];
      const cipher = new CipherView();
      cipher.driversLicense = new DriversLicenseView();
      expect(patchFn(cipher).driversLicense.dateOfBirth).toBe("2025-04-15");
    });

    it("stores an empty string when date is empty", () => {
      component.driversLicenseForm.patchValue({ firstName: "trigger" });

      const patchFn = patchCipherSpy.mock.calls[0][0];
      const cipher = new CipherView();
      cipher.driversLicense = new DriversLicenseView();
      expect(patchFn(cipher).driversLicense.dateOfBirth).toBe("");
    });

    it("prefills date controls from existing cipher", () => {
      const existing = new DriversLicenseView();
      existing.dateOfBirth = "2025-04-15";
      existing.issueDate = "2020-01-01";
      existing.expirationDate = "2030-12-31";

      const cipherView = new CipherView();
      cipherView.driversLicense = existing;
      getInitialCipherView.mockReturnValueOnce(cipherView);

      component.ngOnInit();

      expect(ctrl("dateOfBirth").value).toBe("2025-04-15");
      expect(ctrl("issueDate").value).toBe("2020-01-01");
      expect(ctrl("expirationDate").value).toBe("2030-12-31");
    });
  });
});
