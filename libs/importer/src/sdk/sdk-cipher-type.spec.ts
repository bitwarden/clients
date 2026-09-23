import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherType as SdkCipherType } from "@bitwarden/sdk-internal";

import { toSdkCipherType } from "./sdk-cipher-type";

describe("toSdkCipherType", () => {
  const cases: [CipherType, SdkCipherType][] = [
    [CipherType.Login, SdkCipherType.Login],
    [CipherType.SecureNote, SdkCipherType.SecureNote],
    [CipherType.Card, SdkCipherType.Card],
    [CipherType.Identity, SdkCipherType.Identity],
    [CipherType.SshKey, SdkCipherType.SshKey],
    [CipherType.BankAccount, SdkCipherType.BankAccount],
    [CipherType.DriversLicense, SdkCipherType.DriversLicense],
    [CipherType.Passport, SdkCipherType.Passport],
  ];

  it.each(cases)(
    "maps client type %i to the SDK type with the same numeric value",
    (client, sdk) => {
      const mapped = toSdkCipherType(client);
      expect(mapped).toBe(sdk);
      // The cast-free contract relies on the numeric values staying aligned.
      expect(mapped).toBe(client as number);
    },
  );
});
