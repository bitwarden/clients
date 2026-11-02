import { KeeperAuthError, KeeperAuthErrorCode } from "../../importers/keeper/access";

/** Maps a Keeper login failure to its inline-error i18n key. Pure, so it's testable standalone. */
export function keeperValidationErrorI18nKey(error: unknown): string {
  if (error instanceof KeeperAuthError) {
    switch (error.code) {
      case KeeperAuthErrorCode.Cancelled:
        return "multifactorAuthenticationCancelled";
      case KeeperAuthErrorCode.MfaFailed:
        return "multifactorAuthenticationFailed";
      case KeeperAuthErrorCode.UnsupportedTwoFactorMethod:
        return "keeperUnsupported2faMethod";
      case KeeperAuthErrorCode.SocketError:
        return "keeperConnectionError";
    }
  }
  return "errorOccurred";
}
