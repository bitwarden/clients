// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SendTextApi } from "../api/send-text.api";

export class SendTextData {
  text: string;
  hidden: boolean;

  constructor(data?: SendTextApi) {
    if (data == null) {
      return;
    }

    this.text = data.text;
    this.hidden = data.hidden;
  }
}
