import { MockProxy, mock } from "jest-mock-extended";

import {
  SendHashedPassword,
  SendPasswordKeyMaterial,
  SendPasswordService,
} from "../../../key-management/sends";
import { Utils } from "../../../platform/misc/utils";
import { SendHashedPasswordB64 } from "../types/send-hashed-password-b64.type";

import { DefaultSendTokenService } from "./default-send-token.service";

describe("SendTokenService", () => {
  let service: DefaultSendTokenService;

  let sendPasswordService: MockProxy<SendPasswordService>;

  beforeEach(() => {
    sendPasswordService = mock<SendPasswordService>();

    service = new DefaultSendTokenService(sendPasswordService);
  });

  it("instantiates", () => {
    expect(service).toBeTruthy();
  });

  describe("hashPassword", () => {
    test.each(["", null, undefined])("rejects if password is %p", async (pwd) => {
      await expect(service.hashSendPassword(pwd as any, "keyMaterialUrlB64")).rejects.toThrow(
        "Password must be provided.",
      );
    });

    test.each(["", null, undefined])(
      "rejects if keyMaterialUrlB64 is %p",
      async (keyMaterialUrlB64) => {
        await expect(
          service.hashSendPassword("password", keyMaterialUrlB64 as any),
        ).rejects.toThrow("KeyMaterialUrlB64 must be provided.");
      },
    );

    it("correctly hashes the password", async () => {
      // Arrange
      const password = "testPassword";
      const keyMaterialUrlB64 = "testKeyMaterialUrlB64";
      const keyMaterialArray = new Uint8Array([1, 2, 3]) as SendPasswordKeyMaterial;
      const hashedPasswordArray = new Uint8Array([4, 5, 6]) as SendHashedPassword;
      const sendHashedPasswordB64 = "hashedPasswordB64" as SendHashedPasswordB64;

      const utilsFromUrlB64ToArraySpy = jest
        .spyOn(Utils, "fromUrlB64ToArray")
        .mockReturnValue(keyMaterialArray);

      sendPasswordService.hashPassword.mockResolvedValue(hashedPasswordArray);

      const utilsFromBufferToB64Spy = jest
        .spyOn(Utils, "fromBufferToB64")
        .mockReturnValue(sendHashedPasswordB64);

      // Act
      const result = await service.hashSendPassword(password, keyMaterialUrlB64);

      // Assert
      expect(sendPasswordService.hashPassword).toHaveBeenCalledWith(password, keyMaterialArray);
      expect(utilsFromUrlB64ToArraySpy).toHaveBeenCalledWith(keyMaterialUrlB64);
      expect(utilsFromBufferToB64Spy).toHaveBeenCalledWith(hashedPasswordArray);
      expect(result).toBe(sendHashedPasswordB64);
    });
  });
});
