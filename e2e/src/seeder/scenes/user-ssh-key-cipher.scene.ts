import { SceneTemplate } from "../scene";

/** See `UserSshKeyCipherScene.Request` in the server's util/Seeder/Scenes/UserSshKeyCipherScene.cs. */
export type UserSshKeyCipherArgs = {
  userId: string;
  /** The user key, base64, as `SingleUserScene` returns it in `decryptedKeyB64`. */
  userKeyB64: string;
  name: string;
  /** OpenSSH format, e.g. `-----BEGIN OPENSSH PRIVATE KEY-----`. */
  privateKey: string;
  /** e.g. `ssh-ed25519 AAAA…`. */
  publicKey: string;
  /** e.g. `SHA256:…`. */
  fingerprint: string;
};

/** See `UserSshKeyCipherScene.Result` in the server's util/Seeder/Scenes/UserSshKeyCipherScene.cs. */
export type UserSshKeyCipherResult = {
  cipherId: string;
};

/** An SSH key item in a user's individual vault. */
export class UserSshKeyCipherScene extends SceneTemplate<
  UserSshKeyCipherArgs,
  UserSshKeyCipherResult
> {
  readonly template = "UserSshKeyCipherScene";
}
