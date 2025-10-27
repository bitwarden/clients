import { of } from "rxjs";

import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";

import {
  makeSymmetricCryptoKey,
  mockContainerService,
  mockEnc,
  mockFromJson,
} from "../../../../spec";
import { EncryptedString, EncString } from "../../../key-management/crypto/models/enc-string";
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
  });

  it("Convert", () => {
    const identity = new Identity(data);

    expect(identity).toEqual({
      title: { encryptedString: "enctitle", encryptionType: 0 },
      firstName: { encryptedString: "encfirstName", encryptionType: 0 },
      middleName: { encryptedString: "encmiddleName", encryptionType: 0 },
      lastName: { encryptedString: "enclastName", encryptionType: 0 },
      address1: { encryptedString: "encaddress1", encryptionType: 0 },
      address2: { encryptedString: "encaddress2", encryptionType: 0 },
      address3: { encryptedString: "encaddress3", encryptionType: 0 },
      city: { encryptedString: "enccity", encryptionType: 0 },
      state: { encryptedString: "encstate", encryptionType: 0 },
      postalCode: { encryptedString: "encpostalCode", encryptionType: 0 },
      country: { encryptedString: "enccountry", encryptionType: 0 },
      company: { encryptedString: "enccompany", encryptionType: 0 },
      email: { encryptedString: "encemail", encryptionType: 0 },
      phone: { encryptedString: "encphone", encryptionType: 0 },
      ssn: { encryptedString: "encssn", encryptionType: 0 },
      username: { encryptedString: "encusername", encryptionType: 0 },
      passportNumber: { encryptedString: "encpassportNumber", encryptionType: 0 },
      licenseNumber: { encryptedString: "enclicenseNumber", encryptionType: 0 },
    });
  });

  it("toIdentityData", () => {
    const identity = new Identity(data);
    expect(identity.toIdentityData()).toEqual(data);
  });

  it("Decrypt", async () => {
    const containerService = mockContainerService();
    containerService.getKeyService().userKey$.mockReturnValue(of(makeSymmetricCryptoKey(64)));
    containerService
      .getEncryptService()
      .decryptString.mockImplementation(async (encString: EncString, key: SymmetricCryptoKey) => {
        return encString.data;
      });

    const identity = new Identity();

    identity.title = mockEnc("mockTitle");
    identity.firstName = mockEnc("mockFirstName");
    identity.middleName = mockEnc("mockMiddleName");
    identity.lastName = mockEnc("mockLastName");
    identity.address1 = mockEnc("mockAddress1");
    identity.address2 = mockEnc("mockAddress2");
    identity.address3 = mockEnc("mockAddress3");
    identity.city = mockEnc("mockCity");
    identity.state = mockEnc("mockState");
    identity.postalCode = mockEnc("mockPostalCode");
    identity.country = mockEnc("mockCountry");
    identity.company = mockEnc("mockCompany");
    identity.email = mockEnc("mockEmail");
    identity.phone = mockEnc("mockPhone");
    identity.ssn = mockEnc("mockSsn");
    identity.username = mockEnc("mockUsername");
    identity.passportNumber = mockEnc("mockPassportNumber");
    identity.licenseNumber = mockEnc("mockLicenseNumber");

    const view = await identity.decrypt(null, null);

    expect(view).toEqual({
      _firstName: "mockFirstName",
      _lastName: "mockLastName",
      address1: "mockAddress1",
      address2: "mockAddress2",
      address3: "mockAddress3",
      city: "mockCity",
      company: "mockCompany",
      country: "mockCountry",
      email: "mockEmail",
      licenseNumber: "mockLicenseNumber",
      middleName: "mockMiddleName",
      passportNumber: "mockPassportNumber",
      phone: "mockPhone",
      postalCode: "mockPostalCode",
      ssn: "mockSsn",
      state: "mockState",
      title: "mockTitle",
      username: "mockUsername",
    });
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
