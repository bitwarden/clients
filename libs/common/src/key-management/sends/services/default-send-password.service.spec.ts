import { mock, MockProxy } from "jest-mock-extended";

import { SEND_KDF_ITERATIONS } from "../../../tools/send/send-kdf";
import { CryptoFunctionService } from "../../crypto/abstractions/crypto-function.service";
import { SendPasswordKeyMaterial } from "../types";

import { DefaultSendPasswordService } from "./default-send-password.service";

describe("DefaultSendPasswordService", () => {
  let sendPasswordService: DefaultSendPasswordService;
  let mockCryptoFunctionService: MockProxy<CryptoFunctionService>;

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

    const keyMaterial = new Uint8Array([1, 2, 3, 4, 5]) as SendPasswordKeyMaterial;

    const expectedHash = new Uint8Array([1, 2, 3, 4, 5]); // Mocked hash output
    mockCryptoFunctionService.pbkdf2.mockResolvedValue(expectedHash);

    // Act
    const result = await sendPasswordService.hashPassword(password, keyMaterial);

    // Assert
    expect(mockCryptoFunctionService.pbkdf2).toHaveBeenCalledWith(
      password,
      keyMaterial,
      "sha256",
      SEND_KDF_ITERATIONS,
    );

    expect(result).toEqual(expectedHash);
  });

  it("throws an error if a password isn't provided", async () => {
    // Arrange
    const keyMaterial = new Uint8Array([1, 2, 3, 4, 5]) as SendPasswordKeyMaterial;
    const expectedError = new Error("Password and key material are required.");
    // Act & Assert
    await expect(sendPasswordService.hashPassword("", keyMaterial)).rejects.toThrow(expectedError);
  });

  it("throws an error if key material isn't provided", async () => {
    // Arrange
    const password = "testPassword";
    const expectedError = new Error("Password and key material are required.");
    // Act & Assert
    await expect(
      sendPasswordService.hashPassword(password, undefined as unknown as SendPasswordKeyMaterial),
    ).rejects.toThrow(expectedError);
  });
});
