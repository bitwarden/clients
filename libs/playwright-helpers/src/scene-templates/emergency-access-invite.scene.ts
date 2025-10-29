import { SceneTemplate } from "./scene-template";

export class EmergencyAccessInviteQuery extends SceneTemplate<{
  email: string;
}> {
  template: string = "EmergencyAccessInviteQuery";
}
