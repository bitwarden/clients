import { PassportView } from "./passport.view";

describe("PassportView", () => {
  describe("toSdkPassportView", () => {
    it("should convert populated fields", () => {
      const passportView = Object.assign(new PassportView(), {
        surname: "Doe",
        givenName: "John",
        dateOfBirth: "1990-01-01",
        sex: "M",
        birthPlace: "Springfield",
        nationality: "American",
        issuingCountry: "US",
        passportNumber: "123456789",
        passportType: "P",
        nationalIdentificationNumber: "987654321",
        issuingAuthority: "Department of State",
        issueDate: "2020-01-01",
        expirationDate: "2030-01-01",
      });

      const result = passportView.toSdkPassportView();

      expect(result).toEqual({
        surname: "Doe",
        givenName: "John",
        dateOfBirth: "1990-01-01",
        sex: "M",
        birthPlace: "Springfield",
        nationality: "American",
        issuingCountry: "US",
        passportNumber: "123456789",
        passportType: "P",
        nationalIdentificationNumber: "987654321",
        issuingAuthority: "Department of State",
        issueDate: "2020-01-01",
        expirationDate: "2030-01-01",
      });
    });

    it("should convert empty strings to undefined", () => {
      const passportView = Object.assign(new PassportView(), {
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

    it("should only convert the empty fields to undefined", () => {
      const passportView = Object.assign(new PassportView(), {
        surname: "Doe",
        passportNumber: "",
        nationalIdentificationNumber: "",
      });

      const result = passportView.toSdkPassportView();

      expect(result.surname).toBe("Doe");
      expect(result.passportNumber).toBeUndefined();
      expect(result.nationalIdentificationNumber).toBeUndefined();
    });
  });
});
