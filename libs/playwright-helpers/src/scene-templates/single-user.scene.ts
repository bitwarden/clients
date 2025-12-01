import { UserId } from "@bitwarden/user-core";

import { Scene } from "../scene";

import { SceneTemplate } from "./scene-template";

type SceneResult = UserId;

export type SingleUserScene = Scene<SceneResult>;

export class SingleUserSceneTemplate extends SceneTemplate<
  {
    email: string;
    emailVerified?: boolean;
    premium?: boolean;
  },
  SceneResult
> {
  template: string = "SingleUserScene";
}
