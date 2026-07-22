import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherType as SdkCipherType } from "@bitwarden/sdk-internal";

/**
 * Maps a client {@link CipherType} to the SDK's `CipherType`. The two enums share numeric values
 * today, but the explicit per-value mapping turns any future divergence (a renamed/removed SDK
 * member, or a new client member) into a compile error instead of a silent mismatch through a cast.
 */
export function toSdkCipherType(type: CipherType): SdkCipherType {
  switch (type) {
    case CipherType.Login:
      return SdkCipherType.Login;
    case CipherType.SecureNote:
      return SdkCipherType.SecureNote;
    case CipherType.Card:
      return SdkCipherType.Card;
    case CipherType.Identity:
      return SdkCipherType.Identity;
    case CipherType.SshKey:
      return SdkCipherType.SshKey;
    case CipherType.BankAccount:
      return SdkCipherType.BankAccount;
    case CipherType.DriversLicense:
      return SdkCipherType.DriversLicense;
    case CipherType.Passport:
      return SdkCipherType.Passport;
  }
}
