import { UserId } from "../../../types/guid";
import { CipherType } from "../../enums/cipher-type";
import { Cipher } from "../domain/cipher";
import { Login } from "../domain/login";

import { CipherRequest } from "./cipher.request";

describe("CipherRequest", () => {
  const createLoginCipher = (httpAuthenticationEnabled: boolean | undefined) => {
    const cipher = new Cipher();
    cipher.type = CipherType.Login;
    cipher.login = new Login();
    cipher.login.httpAuthenticationEnabled = httpAuthenticationEnabled;
    return cipher;
  };

  it.each([true, false])("sends the login's HTTP authentication setting (%s)", (enabled) => {
    const request = new CipherRequest({
      cipher: createLoginCipher(enabled),
      encryptedFor: "user-id" as UserId,
    });

    expect(request.login.httpAuthenticationEnabled).toBe(enabled);
  });

  it("leaves an unset HTTP authentication setting unset", () => {
    const request = new CipherRequest({
      cipher: createLoginCipher(undefined),
      encryptedFor: "user-id" as UserId,
    });

    expect(request.login.httpAuthenticationEnabled).toBeUndefined();
  });
});
