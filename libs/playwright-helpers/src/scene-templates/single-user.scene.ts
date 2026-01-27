import { KdfType } from "@bitwarden/key-management";
import { EncString } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { Scene } from "../scene";

import { SceneTemplate } from "./scene-template";

type SceneResult = {
  userId: UserId;
  kdf: KdfType;
  kdfIterations?: number;
  key: EncString;
  privateKey: EncString;
  publicKey: string;
};
type UpParams = {
  email: string;
  emailVerified?: boolean;
  premium?: boolean;
};

export type SingleUserScene = Scene<UpParams, SceneResult>;

export class SingleUserSceneTemplate extends SceneTemplate<UpParams, SceneResult> {
  template: string = "SingleUserScene";
}
