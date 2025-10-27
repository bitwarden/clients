import { mockEnc, mockFromJson } from "../../../../spec";
import { EncryptedString, EncString } from "../../../key-management/crypto/models/enc-string";
import { PasswordHistoryData } from "../../models/data/password-history.data";
import { Password } from "../../models/domain/password";

describe("Password", () => {
  let data: PasswordHistoryData;

  beforeEach(() => {
    data = {
      password: "encPassword",
      lastUsedDate: "2022-01-31T12:00:00.000Z",
    };
  });

  it("Convert from empty", () => {
    const data = new PasswordHistoryData();
    const password = new Password(data);

    expect(password).toBeInstanceOf(Password);
    expect(password.password).toBeInstanceOf(EncString);
    expect(password.lastUsedDate).toBeInstanceOf(Date);
  });

  it("Convert", () => {
    const password = new Password(data);

    expect(password).toEqual({
      password: { encryptedString: "encPassword", encryptionType: 0 },
      lastUsedDate: new Date("2022-01-31T12:00:00.000Z"),
    });
  });

  it("toPasswordHistoryData", () => {
    const password = new Password(data);
    expect(password.toPasswordHistoryData()).toEqual(data);
  });

  it("Decrypt", async () => {
    const password = new Password();
    password.password = mockEnc("password");
    password.lastUsedDate = new Date("2022-01-31T12:00:00.000Z");

    const view = await password.decrypt(null, null);

    expect(view).toEqual({
      password: "password",
      lastUsedDate: new Date("2022-01-31T12:00:00.000Z"),
    });
  });

  describe("fromJSON", () => {
    it("initializes nested objects", () => {
      jest.spyOn(EncString, "fromJSON").mockImplementation(mockFromJson);
      const lastUsedDate = new Date("2022-01-31T12:00:00.000Z");

      const actual = Password.fromJSON({
        password: "myPassword" as EncryptedString,
        lastUsedDate: lastUsedDate.toISOString(),
      });

      expect(actual).toEqual({
        password: "myPassword_fromJSON",
        lastUsedDate: lastUsedDate,
      });
      expect(actual).toBeInstanceOf(Password);
    });

    it("returns undefined if object is null", () => {
      expect(Password.fromJSON(null)).toBeUndefined();
    });
  });

  describe("toSdkPasswordHistory", () => {
    it("returns the correct SDK PasswordHistory object", () => {
      const password = new Password(data);

      const sdkPasswordHistory = password.toSdkPasswordHistory();

      expect(sdkPasswordHistory).toEqual({
        password: "encPassword",
        lastUsedDate: new Date("2022-01-31T12:00:00.000Z").toISOString(),
      });
    });
  });
});
