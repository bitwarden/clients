import { DriversLicenseView } from "./drivers-license.view";

describe("DriversLicenseView", () => {
  describe("toSdkDriversLicenseView", () => {
    it("converts populated fields", () => {
      const driversLicenseView = new DriversLicenseView();
      driversLicenseView.firstName = "Jane";
      driversLicenseView.middleName = "Q";
      driversLicenseView.lastName = "Doe";
      driversLicenseView.dateOfBirth = "1990-01-01";
      driversLicenseView.licenseNumber = "D1234567";
      driversLicenseView.issuingCountry = "US";
      driversLicenseView.issuingState = "CA";
      driversLicenseView.issueDate = "2020-01-01";
      driversLicenseView.expirationDate = "2030-01-01";
      driversLicenseView.issuingAuthority = "DMV";
      driversLicenseView.licenseClass = "C";

      const result = driversLicenseView.toSdkDriversLicenseView();

      expect(result).toEqual({
        firstName: "Jane",
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

    it("converts empty strings to undefined", () => {
      const driversLicenseView = new DriversLicenseView();
      driversLicenseView.firstName = "";
      driversLicenseView.middleName = "";
      driversLicenseView.lastName = "";
      driversLicenseView.dateOfBirth = "";
      driversLicenseView.licenseNumber = "";
      driversLicenseView.issuingCountry = "";
      driversLicenseView.issuingState = "";
      driversLicenseView.issueDate = "";
      driversLicenseView.expirationDate = "";
      driversLicenseView.issuingAuthority = "";
      driversLicenseView.licenseClass = "";

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
  });
});
