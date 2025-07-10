import { mock, MockProxy } from "jest-mock-extended";

import { Utils } from "../../../platform/misc/utils";
import { SEND_KDF_ITERATIONS } from "../../../tools/send/send-kdf";
import { CryptoFunctionService } from "../../crypto/abstractions/crypto-function.service";

import { DefaultSendPasswordService } from "./default-send-password.service";

describe("DefaultSendPasswordService", () => {
  let sendPasswordService: DefaultSendPasswordService;
  let mockCryptoFunctionService: MockProxy<CryptoFunctionService>;

  const fromUrlB64ToArraySpy = jest.spyOn(Utils, "fromUrlB64ToArray");
  const fromBufferToB64Spy = jest.spyOn(Utils, "fromBufferToB64");

  beforeEach(() => {
    mockCryptoFunctionService = mock<CryptoFunctionService>();

    sendPasswordService = new DefaultSendPasswordService(mockCryptoFunctionService);
  });

  it("instantiates", () => {
    expect(sendPasswordService).not.toBeFalsy();
  });

  it("hashes a password with the provided key material", async () => {
    // Arrange
    const password = "testPassword";
    const keyMaterialUrlB64 = "keyMaterialB64";

    const keyMaterialArray = new Uint8Array([1, 2, 3, 4, 5]);
    fromUrlB64ToArraySpy.mockReturnValue(keyMaterialArray);

    const expectedHash = new Uint8Array([1, 2, 3, 4, 5]); // Mocked hash output
    mockCryptoFunctionService.pbkdf2.mockResolvedValue(expectedHash);

    const expectedHashB64 = "AQIDBAU="; // Base64 representation of the expected hash
    fromBufferToB64Spy.mockReturnValue(expectedHashB64);

    // Act
    const result = await sendPasswordService.hashPassword(password, keyMaterialUrlB64);

    // Assert
    expect(mockCryptoFunctionService.pbkdf2).toHaveBeenCalledWith(
      password,
      keyMaterialArray,
      "sha256",
      SEND_KDF_ITERATIONS,
    );

    expect(result).toEqual(expectedHashB64);
  });

  it("throws an error if a password isn't provided", async () => {
    // Arrange
    const keyMaterialUrlB64 = "keyMaterialB64";
    const expectedError = new Error("Password and key material URL base64 string are required.");
    // Act & Assert
    await expect(sendPasswordService.hashPassword("", keyMaterialUrlB64)).rejects.toThrow(
      expectedError,
    );
  });

  it("throws an error if key material isn't provided", async () => {
    // Arrange
    const password = "testPassword";
    const expectedError = new Error("Password and key material URL base64 string are required.");
    // Act & Assert
    await expect(sendPasswordService.hashPassword(password, "")).rejects.toThrow(expectedError);
  });
});
