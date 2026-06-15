import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { getTrimmedCipherUris } from "./risk-insights-data-mappers";

function buildCipher(uris: (string | undefined)[]): CipherView {
  const cipher = new CipherView();
  cipher.type = CipherType.Login;
  cipher.login = new LoginView();
  cipher.login.uris = uris.map((uri) => {
    const uriView = new LoginUriView();
    uriView.uri = uri as string;
    return uriView;
  });
  return cipher;
}

describe("getTrimmedCipherUris", () => {
  it("returns the trimmed domain for a normal URI", () => {
    const cipher = buildCipher(["https://gmail.com"]);

    expect(getTrimmedCipherUris(cipher)).toEqual(["gmail.com"]);
  });

  it("deduplicates URIs that resolve to the same domain", () => {
    const cipher = buildCipher(["https://gmail.com", "gmail.com/login"]);

    expect(getTrimmedCipherUris(cipher)).toEqual(["gmail.com"]);
  });

  it("returns an empty array when the cipher has no login", () => {
    const cipher = new CipherView();
    cipher.login = undefined as unknown as LoginView;

    expect(getTrimmedCipherUris(cipher)).toEqual([]);
  });

  it("returns an empty array when login.uris is undefined", () => {
    const cipher = new CipherView();
    cipher.login = new LoginView();
    cipher.login.uris = undefined as unknown as LoginUriView[];

    expect(getTrimmedCipherUris(cipher)).toEqual([]);
  });

  // Regression for PM-37079: a whitespace-only URI used to fall back to itself
  // (Utils.getDomain returns null for whitespace), passed the truthy check, and
  // ended up as an effectively-empty applicationName in the saved report.
  it("skips whitespace-only URIs", () => {
    const cipher = buildCipher(["   "]);

    expect(getTrimmedCipherUris(cipher)).toEqual([]);
  });

  it("skips empty-string URIs", () => {
    const cipher = buildCipher([""]);

    expect(getTrimmedCipherUris(cipher)).toEqual([]);
  });

  it("skips undefined URIs", () => {
    const cipher = buildCipher([undefined]);

    expect(getTrimmedCipherUris(cipher)).toEqual([]);
  });

  it("returns valid domains alongside skipped invalid URIs in a mixed list", () => {
    const cipher = buildCipher(["https://gmail.com", "   ", "", "https://github.com"]);

    expect(getTrimmedCipherUris(cipher).sort()).toEqual(["github.com", "gmail.com"]);
  });
});
