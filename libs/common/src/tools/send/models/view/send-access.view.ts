// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SendAccessView as SdkSendAccessView } from "@bitwarden/sdk-internal";

import { View } from "../../../../models/view/view";
import { SendType } from "../../types/send-type";
import { SendAccess } from "../domain/send-access";

import { SendFileView } from "./send-file.view";
import { SendItemView } from "./send-item.view";
import { SendTextView } from "./send-text.view";

export class SendAccessView implements View {
  id: string = null;
  name: string = null;
  type: SendType = null;
  text = new SendTextView();
  file = new SendFileView();
  data = new SendItemView();
  expirationDate: Date = null;
  creatorIdentifier: string = null;

  constructor(s?: SendAccess) {
    if (!s) {
      return;
    }

    this.id = s.id;
    this.type = s.type;
    this.expirationDate = s.expirationDate;
    this.creatorIdentifier = s.creatorIdentifier;
  }

  static fromSdk(obj: SdkSendAccessView): SendAccessView {
    const view = new SendAccessView();
    view.id = obj.id;
    view.name = obj.name;
    view.type = obj.type;
    view.text = SendTextView.fromSdk(obj.text);
    view.file = SendFileView.fromSdk(obj.file);
    view.data = SendItemView.fromSdk(obj.data);
    view.expirationDate = new Date(obj.expirationDate);
    view.creatorIdentifier = obj.creatorIdentifier;
    return view;
  }
}
