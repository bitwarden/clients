import { PassportView } from "./passport.view";

describe("PassportView", () => {
  describe("toSdkPassportView", () => {
    it("converts populated fields", () => {
      const passportView = new PassportView();
      passportView.surname = "Doe";
      passportView.givenName = "Jane";
      passportView.dateOfBirth = "1990-01-01";
      passportView.sex = "F";
      passportView.birthPlace = "Santa Barbara";
      passportView.nationality = "US";
      passportView.issuingCountry = "US";
      passportView.passportNumber = "P12345678";
      passportView.passportType = "P";
      passportView.nationalIdentificationNumber = "NID-001";
      passportView.issuingAuthority = "Department of State";
      passportView.issueDate = "2020-01-01";
      passportView.expirationDate = "2030-01-01";

      const result = passportView.toSdkPassportView();

      expect(result).toEqual({
        surname: "Doe",
        givenName: "Jane",
        dateOfBirth: "1990-01-01",
        sex: "F",
        birthPlace: "Santa Barbara",
        nationality: "US",
        issuingCountry: "US",
        passportNumber: "P12345678",
        passportType: "P",
        nationalIdentificationNumber: "NID-001",
        issuingAuthority: "Department of State",
        issueDate: "2020-01-01",
        expirationDate: "2030-01-01",
      });
    });

    it("converts empty strings to undefined", () => {
      const passportView = new PassportView();
      passportView.surname = "";
      passportView.givenName = "";
      passportView.dateOfBirth = "";
      passportView.sex = "";
      passportView.birthPlace = "";
      passportView.nationality = "";
      passportView.issuingCountry = "";
      passportView.passportNumber = "";
      passportView.passportType = "";
      passportView.nationalIdentificationNumber = "";
      passportView.issuingAuthority = "";
      passportView.issueDate = "";
      passportView.expirationDate = "";

      const result = passportView.toSdkPassportView();

      expect(result).toEqual({
        surname: undefined,
        givenName: undefined,
        dateOfBirth: undefined,
        sex: undefined,
        birthPlace: undefined,
        nationality: undefined,
        issuingCountry: undefined,
        passportNumber: undefined,
        passportType: undefined,
        nationalIdentificationNumber: undefined,
        issuingAuthority: undefined,
        issueDate: undefined,
        expirationDate: undefined,
      });
    });
  });
});
