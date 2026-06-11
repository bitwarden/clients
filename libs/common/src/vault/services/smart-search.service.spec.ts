import { CipherType } from "@bitwarden/common/vault/enums";
import { FieldType } from "@bitwarden/common/vault/enums/field-type.enum";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { SmartSearchService } from "./smart-search.service";

function createLoginCipher(
  id: string,
  options: {
    name?: string;
    username?: string;
    uris?: string[];
    notes?: string;
    fields?: { name: string; value: string; type?: FieldType }[];
  } = {},
): CipherView {
  const cipher = new CipherView();
  cipher.id = id;
  cipher.type = CipherType.Login;
  cipher.name = options.name ?? "";
  cipher.notes = options.notes ?? null;

  const login = new LoginView();
  login.username = options.username ?? null;
  login.uris = (options.uris ?? []).map((uri) => {
    const uriView = new LoginUriView();
    uriView.uri = uri;
    return uriView;
  });
  cipher.login = login;

  if (options.fields) {
    cipher.fields = options.fields.map((f) => {
      const field = new FieldView();
      field.name = f.name;
      field.value = f.value;
      field.type = f.type ?? FieldType.Text;
      return field;
    });
  }

  return cipher;
}

describe("SmartSearchService", () => {
  let service: SmartSearchService;

  beforeEach(() => {
    service = new SmartSearchService();
  });

  it("returns all ciphers when the query has no tokens", () => {
    const ciphers = [createLoginCipher("1", { name: "GitHub" })];

    expect(service.searchCiphersBasic(ciphers, "   ")).toEqual(ciphers);
  });

  it("matches tokens in any order across different targets", () => {
    const cipher = createLoginCipher("1", { name: "GitHub", username: "octocat" });

    // "octocat" matches username, "github" matches name — order does not matter.
    expect(service.searchCiphersBasic([cipher], "octocat github")).toEqual([cipher]);
    expect(service.searchCiphersBasic([cipher], "github octocat")).toEqual([cipher]);
  });

  it("excludes a cipher when any token matches no target", () => {
    const cipher = createLoginCipher("1", { name: "GitHub", username: "octocat" });

    expect(service.searchCiphersBasic([cipher], "github missing")).toEqual([]);
  });

  it("matches against name, url, username, subtitle, notes and custom fields", () => {
    const nameMatch = createLoginCipher("1", { name: "Personal" });
    const urlMatch = createLoginCipher("2", { uris: ["https://example.com"] });
    const usernameMatch = createLoginCipher("3", { username: "alice@example.com" });
    const notesMatch = createLoginCipher("4", { notes: "recovery codes here" });
    const fieldMatch = createLoginCipher("5", {
      fields: [{ name: "PIN", value: "secret-value" }],
    });

    expect(service.searchCiphersBasic([nameMatch], "personal")).toEqual([nameMatch]);
    expect(service.searchCiphersBasic([urlMatch], "example.com")).toEqual([urlMatch]);
    expect(service.searchCiphersBasic([usernameMatch], "alice")).toEqual([usernameMatch]);
    expect(service.searchCiphersBasic([notesMatch], "recovery")).toEqual([notesMatch]);
    expect(service.searchCiphersBasic([fieldMatch], "pin")).toEqual([fieldMatch]);
    expect(service.searchCiphersBasic([fieldMatch], "secret-value")).toEqual([fieldMatch]);
  });

  it("does not expose non-text custom field values to search", () => {
    const cipher = createLoginCipher("1", {
      name: "Item",
      fields: [{ name: "Hidden Field", value: "topsecret", type: FieldType.Hidden }],
    });

    // The field name still matches...
    expect(service.searchCiphersBasic([cipher], "hidden")).toEqual([cipher]);
    // ...but the hidden value does not.
    expect(service.searchCiphersBasic([cipher], "topsecret")).toEqual([]);
  });

  it("matches the cipher short id by prefix for tokens of 8+ characters", () => {
    const cipher = createLoginCipher("12345678-1234-1234-1234-123456789012", { name: "Item" });

    expect(service.searchCiphersBasic([cipher], "12345678")).toEqual([cipher]);
    // Shorter than 8 characters does not match the id.
    expect(service.searchCiphersBasic([cipher], "1234")).toEqual([]);
  });

  it("is case-insensitive", () => {
    const cipher = createLoginCipher("1", { name: "GitHub" });

    expect(service.searchCiphersBasic([cipher], "GITHUB")).toEqual([cipher]);
  });
});
