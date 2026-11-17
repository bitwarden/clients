import { DriversLicenseView } from "./drivers-license.view";

describe("DriversLicenseView", () => {
  describe("toSdkDriversLicenseView", () => {
    it("should convert populated fields", () => {
      const driversLicenseView = Object.assign(new DriversLicenseView(), {
        firstName: "John",
        middleName: "Q",
        lastName: "Doe",
        dateOfBirth: "1990-01-01",
        licenseNumber: "D1234567",
        issuingCountry: "US",
        issuingState: "CA",
        issueDate: "2020-01-01",
        expirationDate: "2030-01-01",
        issuingAuthority: "DMV",
        licenseClass: "C",
      });

      const result = driversLicenseView.toSdkDriversLicenseView();

      expect(result).toEqual({
        firstName: "John",
        middleName: "Q",
        lastName: "Doe",
        dateOfBirth: "1990-01-01",
        licenseNumber: "D1234567",
        issuingCountry: "US",
        issuingState: "CA",
        issueDate: "2020-01-01",
        expirationDate: "2030-01-01",
        issuingAuthority: "DMV",
        licenseClass: "C",
      });
    });

    it("should convert empty strings to undefined", () => {
      const driversLicenseView = Object.assign(new DriversLicenseView(), {
        firstName: "",
        middleName: "",
        lastName: "",
        dateOfBirth: "",
        licenseNumber: "",
        issuingCountry: "",
        issuingState: "",
        issueDate: "",
        expirationDate: "",
        issuingAuthority: "",
        licenseClass: "",
      });

      const result = driversLicenseView.toSdkDriversLicenseView();

      expect(result).toEqual({
        firstName: undefined,
        middleName: undefined,
        lastName: undefined,
        dateOfBirth: undefined,
        licenseNumber: undefined,
        issuingCountry: undefined,
        issuingState: undefined,
        issueDate: undefined,
        expirationDate: undefined,
        issuingAuthority: undefined,
        licenseClass: undefined,
      });
    });

    it("should only convert the empty fields to undefined", () => {
      const driversLicenseView = Object.assign(new DriversLicenseView(), {
        firstName: "John",
        licenseNumber: "",
        lastName: "",
      });

      const result = driversLicenseView.toSdkDriversLicenseView();

      expect(result.firstName).toBe("John");
      expect(result.licenseNumber).toBeUndefined();
      expect(result.lastName).toBeUndefined();
    });
  });
});
