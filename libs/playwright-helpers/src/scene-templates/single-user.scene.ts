import { UserId } from "@bitwarden/user-core";

import { Scene } from "../scene";

import { SceneTemplate } from "./scene-template";

type SceneResult = UserId;
type UpParams = {
  email: string;
  emailVerified?: boolean;
  premium?: boolean;
};

export type SingleUserScene = Scene<UpParams, SceneResult>;

export class SingleUserSceneTemplate extends SceneTemplate<UpParams, SceneResult> {
  template: string = "SingleUserScene";
}
