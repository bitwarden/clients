import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { getAutotypeVaultData } from "./desktop-autotype.service";

describe("getAutotypeVaultData", () => {
  it("should return vault data when cipher has username and password", async () => {
    const cipherView = new CipherView();
    cipherView.login.username = "foo";
    cipherView.login.password = "bar";

    const [error, vaultData] = getAutotypeVaultData(cipherView);

    expect(error).toBeNull();
    expect(vaultData?.username).toEqual("foo");
    expect(vaultData?.password).toEqual("bar");
  });

  it("should return error when firstCipher is undefined", async () => {
    const cipherView = undefined;
    const [error, vaultData] = getAutotypeVaultData(cipherView);

    expect(vaultData).toBeNull();
    expect(error).toBeDefined();
    expect(error?.message).toEqual("No matching vault item.");
  });

  it("should return error when username is undefined", async () => {
    const cipherView = new CipherView();
    cipherView.login.username = undefined;
    cipherView.login.password = "bar";

    const [error, vaultData] = getAutotypeVaultData(cipherView);

    expect(vaultData).toBeNull();
    expect(error).toBeDefined();
    expect(error?.message).toEqual("Vault item is undefined.");
  });

  it("should return error when password is undefined", async () => {
    const cipherView = new CipherView();
    cipherView.login.username = "foo";
    cipherView.login.password = undefined;

    const [error, vaultData] = getAutotypeVaultData(cipherView);

    expect(vaultData).toBeNull();
    expect(error).toBeDefined();
    expect(error?.message).toEqual("Vault item is undefined.");
  });
});
