import { CipherType, FieldType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { PasswordHistoryView } from "@bitwarden/common/vault/models/view/password-history.view";

import { CipherResponse } from "./cipher.response";

describe("CipherResponse", () => {
  function createLoginCipherView({
    viewPassword,
    withPasswordHistory,
    withHiddenField,
  }: {
    viewPassword: boolean;
    withPasswordHistory: boolean;
    withHiddenField?: boolean;
  }) {
    const cipherView = new CipherView();
    cipherView.id = "11111111-1111-1111-1111-111111111111";
    cipherView.type = CipherType.Login;
    cipherView.name = "Test Login";
    cipherView.viewPassword = viewPassword;

    const login = new LoginView();
    login.username = "someuser";
    login.password = "supersecret";
    login.totp = "JBSWY3DPEHPK3PXP";
    cipherView.login = login;

    if (withPasswordHistory) {
      const oldPassword = new PasswordHistoryView();
      oldPassword.password = "old-super-secret";
      oldPassword.lastUsedDate = new Date();
      cipherView.passwordHistory = [oldPassword];
    }

    if (withHiddenField) {
      const hiddenField = new FieldView();
      hiddenField.name = "API Key";
      hiddenField.value = "secret-hidden-value";
      hiddenField.type = FieldType.Hidden;

      const textField = new FieldView();
      textField.name = "Notes";
      textField.value = "not-sensitive";
      textField.type = FieldType.Text;

      cipherView.fields = [hiddenField, textField];
    }

    return cipherView;
  }

  describe("when the user has permission to view the password (viewPassword: true)", () => {
    it("includes the password and totp", () => {
      const res = new CipherResponse(
        createLoginCipherView({ viewPassword: true, withPasswordHistory: false }),
      );

      expect(res.login.password).toBe("supersecret");
      expect(res.login.totp).toBe("JBSWY3DPEHPK3PXP");
    });

    it("includes password history", () => {
      const res = new CipherResponse(
        createLoginCipherView({ viewPassword: true, withPasswordHistory: true }),
      );

      expect(res.passwordHistory).toEqual([
        expect.objectContaining({ password: "old-super-secret" }),
      ]);
    });

    it("includes hidden field values", () => {
      const res = new CipherResponse(
        createLoginCipherView({
          viewPassword: true,
          withPasswordHistory: false,
          withHiddenField: true,
        }),
      );

      expect(res.fields[0]).toEqual(expect.objectContaining({ value: "secret-hidden-value" }));
      expect(res.fields[1]).toEqual(expect.objectContaining({ value: "not-sensitive" }));
    });
  });

  describe("when the user does not have permission to view the password (viewPassword: false)", () => {
    it("redacts the password and totp", () => {
      const res = new CipherResponse(
        createLoginCipherView({ viewPassword: false, withPasswordHistory: false }),
      );

      expect(res.login.password).toBeNull();
      expect(res.login.totp).toBeNull();
    });

    it("redacts password history", () => {
      const res = new CipherResponse(
        createLoginCipherView({ viewPassword: false, withPasswordHistory: true }),
      );

      expect(res.passwordHistory).toBeUndefined();
    });

    it("redacts hidden field values but leaves other field types untouched", () => {
      const res = new CipherResponse(
        createLoginCipherView({
          viewPassword: false,
          withPasswordHistory: false,
          withHiddenField: true,
        }),
      );

      expect(res.fields[0]).toEqual(expect.objectContaining({ value: null }));
      expect(res.fields[1]).toEqual(expect.objectContaining({ value: "not-sensitive" }));
    });
  });
});
