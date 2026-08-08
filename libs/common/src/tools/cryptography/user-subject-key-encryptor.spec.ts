import { mock } from "jest-mock-extended";

import { makeEncString } from "../../../spec";
import { EncString } from "../../key-management/crypto/models/enc-string";
import { UserId } from "../../types/guid";

import { UserEncryptor } from "./user-encryptor.abstraction";
import { UserSubjectKeyEncryptor } from "./user-subject-key-encryptor";

describe("UserSubjectKeyEncryptor", () => {
  const userEncryptor = mock<UserEncryptor>();
  const anyUserId = "foo" as UserId;
  const anySubjectId = "state/key";

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("constructor", () => {
    it("should set userId", () => {
      const encryptor = new UserSubjectKeyEncryptor(anyUserId, anySubjectId, userEncryptor);
      expect(encryptor.userId).toEqual(anyUserId);
    });

    it("should set subjectId", () => {
      const encryptor = new UserSubjectKeyEncryptor(anyUserId, anySubjectId, userEncryptor);
      expect(encryptor.subjectId).toEqual(anySubjectId);
    });

    it("should throw if userId was not supplied", () => {
      expect(
        () => new UserSubjectKeyEncryptor(null as unknown as UserId, anySubjectId, userEncryptor),
      ).toThrow("userId cannot be null or undefined");
      expect(
        () =>
          new UserSubjectKeyEncryptor(undefined as unknown as UserId, anySubjectId, userEncryptor),
      ).toThrow("userId cannot be null or undefined");
    });

    it("should throw if subjectId was not supplied", () => {
      expect(
        () => new UserSubjectKeyEncryptor(anyUserId, null as unknown as string, userEncryptor),
      ).toThrow("subjectId cannot be null or undefined");
      expect(
        () => new UserSubjectKeyEncryptor(anyUserId, undefined as unknown as string, userEncryptor),
      ).toThrow("subjectId cannot be null or undefined");
    });

    it("should throw if userEncryptor was not supplied", () => {
      expect(
        () =>
          new UserSubjectKeyEncryptor(anyUserId, anySubjectId, null as unknown as UserEncryptor),
      ).toThrow("userEncryptor cannot be null or undefined");
      expect(
        () =>
          new UserSubjectKeyEncryptor(
            anyUserId,
            anySubjectId,
            undefined as unknown as UserEncryptor,
          ),
      ).toThrow("userEncryptor cannot be null or undefined");
    });
  });

  describe("encrypt", () => {
    it("should delegate to the userEncryptor", async () => {
      const encryptor = new UserSubjectKeyEncryptor(anyUserId, anySubjectId, userEncryptor);
      const value = { foo: true };
      const expectedEncString = makeEncString();
      userEncryptor.encrypt.mockResolvedValue(expectedEncString);

      const result = await encryptor.encrypt(value);

      expect(userEncryptor.encrypt).toHaveBeenCalledWith(value);
      expect(result).toEqual(expectedEncString);
    });
  });

  describe("decrypt", () => {
    it("should delegate to the userEncryptor", async () => {
      const encryptor = new UserSubjectKeyEncryptor(anyUserId, anySubjectId, userEncryptor);
      const secret = makeEncString();
      const expectedValue = { foo: "bar" };
      (userEncryptor.decrypt as jest.Mock).mockResolvedValue(expectedValue);

      const result = await encryptor.decrypt(secret as unknown as EncString);

      expect(userEncryptor.decrypt).toHaveBeenCalledWith(secret);
      expect(result).toEqual(expectedValue);
    });
  });
});
