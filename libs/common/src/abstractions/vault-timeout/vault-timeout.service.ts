// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export abstract class VaultTimeoutService {
  checkVaultTimeout: () => Promise<void>;
  lock: (userId?: string) => Promise<void>;
  logOut: (userId?: string) => Promise<void>;
}
