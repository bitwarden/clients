import { EncString } from "@bitwarden/sdk-internal";

import { mockContainerService } from "../../../../spec";
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

  it("toIdentityData", () => {
    const identity = new Identity(data);
    expect(identity.toIdentityData()).toEqual(data);
  });

  describe("fromJSON", () => {
    it("initializes nested objects", () => {
      const actual = Identity.fromJSON({
        firstName: "mockFirstName" as EncString,
        lastName: "mockLastName" as EncString,
        address1: "mockAddress1" as EncString,
        address2: "mockAddress2" as EncString,
        address3: "mockAddress3" as EncString,
        city: "mockCity" as EncString,
        company: "mockCompany" as EncString,
        country: "mockCountry" as EncString,
        email: "mockEmail" as EncString,
        licenseNumber: "mockLicenseNumber" as EncString,
        middleName: "mockMiddleName" as EncString,
        passportNumber: "mockPassportNumber" as EncString,
        phone: "mockPhone" as EncString,
        postalCode: "mockPostalCode" as EncString,
        ssn: "mockSsn" as EncString,
        state: "mockState" as EncString,
        title: "mockTitle" as EncString,
        username: "mockUsername" as EncString,
      });

      expect(actual).toEqual({
        firstName: "mockFirstName",
        lastName: "mockLastName",
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
