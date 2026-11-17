import { Account } from "../../credentials";
import { WEB_VAULT_URL } from "../../server";
import { Scene, SceneTemplate } from "../scene";

/** The server's `Bit.Core.Enums.GatewayType`, which the SeederApi reads as numbers. */
export const GatewayType = Object.freeze({
  Stripe: 0,
  Braintree: 1,
  AppStore: 2,
  PlayStore: 3,
  BitPay: 4,
  PayPal: 5,
  Bank: 6,
} as const);
export type GatewayType = (typeof GatewayType)[keyof typeof GatewayType];

/** See `SingleUserScene.Request` in the server's util/Seeder/Scenes/SingleUserScene.cs. */
export type SingleUserArgs = {
  /** Mangled by the server; use an `example.com` address. */
  email: string;
  /** Not mangled. */
  password: string;
  /** Implied by `premium`. */
  emailVerified?: boolean;
  premium?: boolean;
  /** Writes a self-hosted premium license; only a self-hosted SeederApi accepts it with `premium`. */
  selfHosted?: boolean;
  /** Billing gateway identity, so the user resembles a billed one. No Stripe calls are made. */
  gateway?: GatewayType;
  /** Refused by a self-hosted SeederApi. */
  gatewayCustomerId?: string;
  /** Refused by a self-hosted SeederApi. */
  gatewaySubscriptionId?: string;
  /**
   * PBKDF2 iterations, 5,000 to 2,000,000; 5,000 when unset. The web vault raises anything
   * under 600,000 on login, after which `kdfIterations` and `key` in the result are stale.
   */
  kdfIterations?: number;
  /** Enrolls the user in email two-factor, delivered to the mangled email. */
  enrollInEmail2Fa?: boolean;
  /** Stores an undecryptable private key, which the web vault's Data Recovery tool replaces. */
  corruptPrivateKey?: boolean;
};

/** See `SingleUserSceneResult` in the server's util/Seeder/Scenes/SingleUserScene.cs. */
export type SingleUserResult = {
  userId: string;
  /** The KDF's name, e.g. `PBKDF2_SHA256`. */
  kdf: string;
  kdfIterations: number;
  /** The user key, encrypted with the master key. */
  key: string;
  /** The user key, base64, e.g. for enrolling the user in account recovery. */
  decryptedKeyB64: string;
  publicKey: string;
  privateKey: string;
  apiKey: string;
  /** Whether a self-hosted premium license was written. */
  premiumLicenseWritten: boolean;
  /** Why a self-hosted premium license could not be written. */
  premiumLicenseWarning: string | null;
  /** Set with `enrollInEmail2Fa`. */
  twoFactorRecoveryCode: string | null;
};

/** A standalone user with a master password. */
export class SingleUserScene extends SceneTemplate<SingleUserArgs, SingleUserResult> {
  readonly template = "SingleUserScene";
}

/** The account to log in as, with the email the server stored. */
export function seededAccount(scene: Scene<SingleUserArgs, SingleUserResult>): Account {
  return {
    email: scene.mangle(scene.args.email),
    password: scene.args.password,
    server: WEB_VAULT_URL,
  };
}
