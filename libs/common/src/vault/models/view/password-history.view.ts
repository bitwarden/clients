// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { View } from "../../../models/view/view";
import { Password } from "../domain/password";

export class PasswordHistoryView implements View {
  password: string = null;
  lastUsedDate: Date = null;

  constructor(ph?: Password) {
    if (!ph) {
      return;
    }

    this.lastUsedDate = ph.lastUsedDate;
  }

  static fromJSON(obj: Partial<Jsonify<PasswordHistoryView>>): PasswordHistoryView {
    const lastUsedDate = obj.lastUsedDate == null ? null : new Date(obj.lastUsedDate);

    return Object.assign(new PasswordHistoryView(), obj, {
      lastUsedDate: lastUsedDate,
    });
  }
}
