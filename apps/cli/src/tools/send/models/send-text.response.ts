// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SendTextView } from "@bitwarden/common/tools/send/models/view/send-text.view";

export class SendTextResponse {
  static template(text = "Text contained in the send.", hidden = false): SendTextResponse {
    const req = new SendTextResponse();
    req.text = text;
    req.hidden = hidden;
    return req;
  }

  static toView(text: SendTextResponse, view = new SendTextView()) {
    if (text == null) {
      return null;
    }

    view.text = text.text;
    view.hidden = text.hidden;
    return view;
  }
  text: string;
  hidden: boolean;

  constructor(o?: SendTextView) {
    if (o == null) {
      return;
    }
    this.text = o.text;
    this.hidden = o.hidden;
  }
}
