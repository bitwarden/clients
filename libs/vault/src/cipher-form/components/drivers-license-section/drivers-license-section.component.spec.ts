import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { AbstractControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
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

  /** Helper to get a date FormGroup by name. */
  function dateGroup(name: "dateOfBirth" | "issueDate" | "expirationDate"): FormGroup {
    return component.driversLicenseForm.get(name) as FormGroup;
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

  describe("numeric input filtering", () => {
    it.each(["dateOfBirth", "issueDate", "expirationDate"] as const)(
      "strips non-digit characters from %s day field",
      (groupName) => {
        ctrl(`${groupName}.day`).setValue("12a");
        expect(ctrl(`${groupName}.day`).value).toBe("12");
      },
    );

    it.each(["dateOfBirth", "issueDate", "expirationDate"] as const)(
      "strips non-digit characters from %s year field",
      (groupName) => {
        ctrl(`${groupName}.year`).setValue("20ab25");
        expect(ctrl(`${groupName}.year`).value).toBe("2025");
      },
    );

    it("preserves valid numeric input in day field", () => {
      ctrl("dateOfBirth.day").setValue("15");
      expect(ctrl("dateOfBirth.day").value).toBe("15");
    });

    it("preserves valid numeric input in year field", () => {
      ctrl("dateOfBirth.year").setValue("2025");
      expect(ctrl("dateOfBirth.year").value).toBe("2025");
    });

    it("does not modify an empty day field", () => {
      ctrl("dateOfBirth.day").setValue("");
      expect(ctrl("dateOfBirth.day").value).toBe("");
    });
  });

  describe("month + year cross-field validation", () => {
    it.each(["dateOfBirth", "issueDate", "expirationDate"] as const)(
      "sets crossFieldRequired error on year when month is set without year (%s)",
      (groupName) => {
        dateGroup(groupName).get("month")!.setValue("4");

        expect(dateGroup(groupName).get("year")!.hasError("crossFieldRequired")).toBe(true);
        expect(dateGroup(groupName).get("year")!.getError("crossFieldRequired").message).toBe(
          "enterYear",
        );
      },
    );

    it.each(["dateOfBirth", "issueDate", "expirationDate"] as const)(
      "sets crossFieldRequired error on month when year is set without month (%s)",
      (groupName) => {
        dateGroup(groupName).get("year")!.setValue("2025");

        expect(dateGroup(groupName).get("month")!.hasError("crossFieldRequired")).toBe(true);
        expect(dateGroup(groupName).get("month")!.getError("crossFieldRequired").message).toBe(
          "enterMonth",
        );
      },
    );

    it("does not mark the affected control as touched (errors surface on submit)", () => {
      dateGroup("dateOfBirth").get("month")!.setValue("4");
      expect(dateGroup("dateOfBirth").get("year")!.touched).toBe(false);
    });

    it("clears crossFieldRequired error when both month and year are provided", () => {
      const group = dateGroup("dateOfBirth");
      group.get("month")!.setValue("4");
      group.get("year")!.setValue("2025");

      expect(group.get("year")!.hasError("crossFieldRequired")).toBe(false);
      expect(group.get("month")!.hasError("crossFieldRequired")).toBe(false);
    });

    it("clears crossFieldRequired error when both month and year are cleared", () => {
      const group = dateGroup("dateOfBirth");
      group.get("month")!.setValue("4");
      group.get("month")!.setValue("");

      expect(group.get("year")!.hasError("crossFieldRequired")).toBe(false);
    });
  });

  describe("date combining and parsing", () => {
    it("combines month, day, and year into a YYYY-M-D string on the model", () => {
      dateGroup("dateOfBirth").patchValue({ month: "4", day: "15", year: "2025" });

      const patchFn = patchCipherSpy.mock.calls[0][0];
      const cipher = new CipherView();
      cipher.driversLicense = new DriversLicenseView();
      expect(patchFn(cipher).driversLicense.dateOfBirth).toBe("2025-4-15");
    });

    it("stores an empty string when all date parts are empty", () => {
      component.driversLicenseForm.patchValue({ firstName: "trigger" });

      const patchFn = patchCipherSpy.mock.calls[0][0];
      const cipher = new CipherView();
      cipher.driversLicense = new DriversLicenseView();
      expect(patchFn(cipher).driversLicense.dateOfBirth).toBe("");
    });

    it("parses a YYYY-MM-DD date string into month, day, and year controls on init", () => {
      const existing = new DriversLicenseView();
      existing.dateOfBirth = "2025-04-15";
      existing.issueDate = "2020-01-01";
      existing.expirationDate = "2030-12-31";

      const cipherView = new CipherView();
      cipherView.driversLicense = existing;
      getInitialCipherView.mockReturnValueOnce(cipherView);

      component.ngOnInit();

      expect(ctrl("dateOfBirth.month").value).toBe("4");
      expect(ctrl("dateOfBirth.day").value).toBe("15");
      expect(ctrl("dateOfBirth.year").value).toBe("2025");

      expect(ctrl("issueDate.month").value).toBe("1");
      expect(ctrl("issueDate.day").value).toBe("1");
      expect(ctrl("issueDate.year").value).toBe("2020");

      expect(ctrl("expirationDate.month").value).toBe("12");
      expect(ctrl("expirationDate.day").value).toBe("31");
      expect(ctrl("expirationDate.year").value).toBe("2030");
    });
  });
});
