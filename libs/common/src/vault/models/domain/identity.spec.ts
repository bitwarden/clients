// eslint-disable-next-line no-restricted-imports
import { EncryptedString, EncString } from "@bitwarden/legacy-crypto";

import { mockContainerService, mockFromJson } from "../../../../spec";
import { IdentityData } from "../../models/data/identity.data";
import { Identity } from "../../models/domain/identity";

describe("Identity", () => {
  let data: IdentityData;

  beforeEach(() => {
    data = {
      title: "enctitle",
      firstName: "encfirstName",
      middleName: "encmiddleName",
      lastName: "enclastName",
      address1: "encaddress1",
      address2: "encaddress2",
      address3: "encaddress3",
      city: "enccity",
      state: "encstate",
      postalCode: "encpostalCode",
      country: "enccountry",
      company: "enccompany",
      email: "encemail",
      phone: "encphone",
      ssn: "encssn",
      username: "encusername",
      passportNumber: "encpassportNumber",
      licenseNumber: "enclicenseNumber",
    };

    mockContainerService();
  });

  it("Convert from empty", () => {
    const data = new IdentityData();
    const identity = new Identity(data);

    expect(identity).toEqual({
      address1: undefined,
      address2: undefined,
      address3: undefined,
      city: undefined,
      company: undefined,
      country: undefined,
      email: undefined,
      firstName: undefined,
      lastName: undefined,
      licenseNumber: undefined,
      middleName: undefined,
      passportNumber: undefined,
      phone: undefined,
      postalCode: undefined,
      ssn: undefined,
      state: undefined,
      title: undefined,
      username: undefined,
    });

    expect(data).toEqual({
      title: undefined,
      firstName: undefined,
      middleName: undefined,
      lastName: undefined,
      address1: undefined,
      address2: undefined,
      address3: undefined,
      city: undefined,
      state: undefined,
      postalCode: undefined,
      country: undefined,
      company: undefined,
      email: undefined,
      phone: undefined,
      ssn: undefined,
      username: undefined,
      passportNumber: undefined,
      licenseNumber: undefined,
    });
  });

  it("Convert", () => {
    const identity = new Identity(data);

    expect(identity).toEqual({
      title: { encryptedString: "enctitle" },
      firstName: { encryptedString: "encfirstName" },
      middleName: { encryptedString: "encmiddleName" },
      lastName: { encryptedString: "enclastName" },
      address1: { encryptedString: "encaddress1" },
      address2: { encryptedString: "encaddress2" },
      address3: { encryptedString: "encaddress3" },
      city: { encryptedString: "enccity" },
      state: { encryptedString: "encstate" },
      postalCode: { encryptedString: "encpostalCode" },
      country: { encryptedString: "enccountry" },
      company: { encryptedString: "enccompany" },
      email: { encryptedString: "encemail" },
      phone: { encryptedString: "encphone" },
      ssn: { encryptedString: "encssn" },
      username: { encryptedString: "encusername" },
      passportNumber: { encryptedString: "encpassportNumber" },
      licenseNumber: { encryptedString: "enclicenseNumber" },
    });
  });

  it("toIdentityData", () => {
    const identity = new Identity(data);
    expect(identity.toIdentityData()).toEqual(data);
  });

  describe("fromJSON", () => {
    it("initializes nested objects", () => {
      jest.spyOn(EncString, "fromJSON").mockImplementation(mockFromJson);

      const actual = Identity.fromJSON({
        firstName: "mockFirstName" as EncryptedString,
        lastName: "mockLastName" as EncryptedString,
        address1: "mockAddress1" as EncryptedString,
        address2: "mockAddress2" as EncryptedString,
        address3: "mockAddress3" as EncryptedString,
        city: "mockCity" as EncryptedString,
        company: "mockCompany" as EncryptedString,
        country: "mockCountry" as EncryptedString,
        email: "mockEmail" as EncryptedString,
        licenseNumber: "mockLicenseNumber" as EncryptedString,
        middleName: "mockMiddleName" as EncryptedString,
        passportNumber: "mockPassportNumber" as EncryptedString,
        phone: "mockPhone" as EncryptedString,
        postalCode: "mockPostalCode" as EncryptedString,
        ssn: "mockSsn" as EncryptedString,
        state: "mockState" as EncryptedString,
        title: "mockTitle" as EncryptedString,
        username: "mockUsername" as EncryptedString,
      });

      expect(actual).toEqual({
        firstName: "mockFirstName_fromJSON",
        lastName: "mockLastName_fromJSON",
        address1: "mockAddress1_fromJSON",
        address2: "mockAddress2_fromJSON",
        address3: "mockAddress3_fromJSON",
        city: "mockCity_fromJSON",
        company: "mockCompany_fromJSON",
        country: "mockCountry_fromJSON",
        email: "mockEmail_fromJSON",
        licenseNumber: "mockLicenseNumber_fromJSON",
        middleName: "mockMiddleName_fromJSON",
        passportNumber: "mockPassportNumber_fromJSON",
        phone: "mockPhone_fromJSON",
        postalCode: "mockPostalCode_fromJSON",
        ssn: "mockSsn_fromJSON",
        state: "mockState_fromJSON",
        title: "mockTitle_fromJSON",
        username: "mockUsername_fromJSON",
      });
      expect(actual).toBeInstanceOf(Identity);
    });

    it("returns undefined if object is null", () => {
      expect(Identity.fromJSON(null)).toBeUndefined();
    });
  });

  describe("toSdkIdentity", () => {
    it("returns the correct SDK Identity object", () => {
      const identity = new Identity(data);
      const sdkIdentity = identity.toSdkIdentity();

      expect(sdkIdentity).toEqual({
        title: "enctitle",
        firstName: "encfirstName",
        middleName: "encmiddleName",
        lastName: "enclastName",
        address1: "encaddress1",
        address2: "encaddress2",
        address3: "encaddress3",
        city: "enccity",
        state: "encstate",
        postalCode: "encpostalCode",
        country: "enccountry",
        company: "enccompany",
        email: "encemail",
        phone: "encphone",
        ssn: "encssn",
        username: "encusername",
        passportNumber: "encpassportNumber",
        licenseNumber: "enclicenseNumber",
      });
    });
  });
});
