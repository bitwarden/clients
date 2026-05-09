import { CipherType } from "../../vault/enums";
import { FieldType } from "../../vault/enums/field-type.enum";
import { CipherView } from "../../vault/models/view/cipher.view";
import { FieldView } from "../../vault/models/view/field.view";
import { LoginUriView } from "../../vault/models/view/login-uri.view";
import { LoginView } from "../../vault/models/view/login.view";

import { cipherToSendTextView } from "./cipher-to-send-text";
import { SendType } from "./types/send-type";

function makeLoginCipher(overrides: Partial<LoginView> = {}, name = "GitHub"): CipherView {
  const cipher = new CipherView();
  cipher.name = name;
  cipher.type = CipherType.Login;
  const login = new LoginView();
  login.username = "alice@example.com";
  login.password = "hunter2";
  login.totp = "JBSWY3DPEHPK3PXP";
  const uri = new LoginUriView();
  uri.uri = "https://github.com";
  login.uris = [uri];
  Object.assign(login, overrides);
  cipher.login = login;
  return cipher;
}

function makeField(name: string, value: string, type: FieldType = FieldType.Text): FieldView {
  const field = new FieldView();
  field.name = name;
  field.value = value;
  field.type = type;
  return field;
}

describe("cipherToSendTextView", () => {
  it("returns a Text Send with the cipher name and a one-day deletion date", () => {
    const before = Date.now();
    const view = cipherToSendTextView(makeLoginCipher());
    const after = Date.now();

    expect(view.type).toBe(SendType.Text);
    expect(view.name).toBe("GitHub");

    const dayMs = 24 * 60 * 60 * 1000;
    expect(view.deletionDate.getTime()).toBeGreaterThanOrEqual(before + dayMs - 1000);
    expect(view.deletionDate.getTime()).toBeLessThanOrEqual(after + dayMs + 1000);
  });

  it("hides the text body by default to mask the credential at-a-glance", () => {
    const view = cipherToSendTextView(makeLoginCipher());
    expect(view.text.hidden).toBe(true);
  });

  it("includes username, password, and website for a login cipher", () => {
    const view = cipherToSendTextView(makeLoginCipher());
    expect(view.text.text).toContain("Username: alice@example.com");
    expect(view.text.text).toContain("Password: hunter2");
    expect(view.text.text).toContain("Website: https://github.com");
  });

  it("excludes TOTP by default", () => {
    const view = cipherToSendTextView(makeLoginCipher());
    expect(view.text.text).not.toContain("TOTP");
    expect(view.text.text).not.toContain("JBSWY3DPEHPK3PXP");
  });

  it("includes TOTP only when the caller opts in", () => {
    const view = cipherToSendTextView(makeLoginCipher(), { includeTotp: true });
    expect(view.text.text).toContain("TOTP: JBSWY3DPEHPK3PXP");
  });

  it("excludes custom fields by default", () => {
    const cipher = makeLoginCipher();
    cipher.fields = [makeField("Recovery code", "AAAA-BBBB-CCCC")];
    const view = cipherToSendTextView(cipher);
    expect(view.text.text).not.toContain("Recovery code");
    expect(view.text.text).not.toContain("AAAA-BBBB-CCCC");
  });

  it("includes non-hidden custom fields when the caller opts in", () => {
    const cipher = makeLoginCipher();
    cipher.fields = [makeField("Account ID", "12345")];
    const view = cipherToSendTextView(cipher, { includeCustomFields: true });
    expect(view.text.text).toContain("Account ID: 12345");
  });

  it("never includes hidden custom fields, even when opted in", () => {
    const cipher = makeLoginCipher();
    cipher.fields = [
      makeField("Visible", "ok", FieldType.Text),
      makeField("Backup code", "secret-value", FieldType.Hidden),
    ];
    const view = cipherToSendTextView(cipher, { includeCustomFields: true });
    expect(view.text.text).toContain("Visible: ok");
    expect(view.text.text).not.toContain("Backup code");
    expect(view.text.text).not.toContain("secret-value");
  });

  it("appends notes after the credential lines, separated by a blank line", () => {
    const cipher = makeLoginCipher();
    cipher.notes = "Used for the team account.";
    const view = cipherToSendTextView(cipher);
    const lines = view.text.text.split("\n");
    const notesIndex = lines.indexOf("Notes:");
    expect(notesIndex).toBeGreaterThan(0);
    expect(lines[notesIndex - 1]).toBe("");
    expect(lines[notesIndex + 1]).toBe("Used for the team account.");
    expect(lines[0].startsWith("Username: ")).toBe(true);
  });

  it("emits notes alone when the cipher has no login fields", () => {
    const cipher = new CipherView();
    cipher.name = "Reminder";
    cipher.type = CipherType.SecureNote;
    cipher.notes = "Server admin contact: ops@example.com";
    const view = cipherToSendTextView(cipher);
    expect(view.text.text).toBe("Notes:\nServer admin contact: ops@example.com");
  });

  it("skips empty login fields gracefully", () => {
    const cipher = makeLoginCipher({ password: undefined, totp: undefined, uris: [] });
    const view = cipherToSendTextView(cipher);
    expect(view.text.text).toBe("Username: alice@example.com");
  });

  it("returns an empty body for a cipher with no shareable content", () => {
    const cipher = new CipherView();
    cipher.name = "Empty";
    cipher.type = CipherType.SecureNote;
    const view = cipherToSendTextView(cipher);
    expect(view.text.text).toBe("");
    expect(view.name).toBe("Empty");
  });
});
