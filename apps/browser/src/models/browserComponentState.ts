// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

export class BrowserComponentState {
  scrollY: number;
  searchText: string;

  static fromJSON(json: Jsonify<BrowserComponentState>) {
    if (json == null) {
      return null;
    }

    return Object.assign(new BrowserComponentState(), json);
  }
}
