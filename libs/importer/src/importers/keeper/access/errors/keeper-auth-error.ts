export const KeeperAuthErrorCode = Object.freeze({
  Cancelled: 1,
  MfaFailed: 2,
  UnsupportedTwoFactorMethod: 3,
  SocketError: 4,
} as const);
export type KeeperAuthErrorCode = (typeof KeeperAuthErrorCode)[keyof typeof KeeperAuthErrorCode];

export class KeeperAuthError extends Error {
  readonly code: KeeperAuthErrorCode;

  constructor(code: KeeperAuthErrorCode, message: string) {
    super(message);
    this.name = "KeeperAuthError";
    this.code = code;
  }
}
