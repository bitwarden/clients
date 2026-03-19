// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { LastpassLoginType, Platform } from "../enums";

export class ClientInfo {
  platform: Platform;
  id: string;
  description: string;
  login: LastpassLoginType;

  static createClientInfo(id: string): ClientInfo {
    return {
      platform: Platform.Desktop,
      id,
      description: "Importer",
      login: LastpassLoginType.MasterPassword,
    };
  }
}
