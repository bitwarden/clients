// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { InitiationPath } from "../../billing/enums";

export class ReferenceEventRequest {
  id: string;
  session: string;
  layout: string;
  flow: string;
  initiationPath: InitiationPath;
}
