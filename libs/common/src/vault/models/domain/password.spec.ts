import { mockContainerService, mockEnc, mockFromJson } from "../../../../spec";
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
    mockContainerService();
  });

  it("Convert from empty", () => {
    const data = new PasswordHistoryData();
    const password = new Password(data);

    expect(password).toBeInstanceOf(Password);
    expect(password.password).toBeInstanceOf(EncString);
    expect(password.lastUsedDate).toBeInstanceOf(Date);

    expect(data.password).toBeUndefined();
    expect(data.lastUsedDate).toBeUndefined();
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

    const view = await password.decrypt(null);

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

  describe("fromSdkPasswordHistory", () => {
    beforeEach(() => {
      jest.restoreAllMocks();
    });

    it("creates Password from SDK object", () => {
      const sdkPasswordHistory = {
        password: "2.encPassword|encryptedData" as EncryptedString,
        lastUsedDate: "2022-01-31T12:00:00.000Z",
      };

      const password = Password.fromSdkPasswordHistory(sdkPasswordHistory);

      expect(password).toBeInstanceOf(Password);
      expect(password?.password).toBeInstanceOf(EncString);
      expect(password?.password.encryptedString).toBe("2.encPassword|encryptedData");
      expect(password?.lastUsedDate).toEqual(new Date("2022-01-31T12:00:00.000Z"));
    });

    it("returns undefined for null input", () => {
      const result = Password.fromSdkPasswordHistory(null as any);
      expect(result).toBeUndefined();
    });

    it("returns undefined for undefined input", () => {
      const result = Password.fromSdkPasswordHistory(undefined);
      expect(result).toBeUndefined();
    });

    it("handles empty SDK object", () => {
      const sdkPasswordHistory = {
        password: "" as EncryptedString,
        lastUsedDate: "",
      };

      const password = Password.fromSdkPasswordHistory(sdkPasswordHistory);

      expect(password).toBeInstanceOf(Password);
      expect(password?.password).toBeInstanceOf(EncString);
      expect(password?.lastUsedDate).toBeInstanceOf(Date);
    });
  });
});
