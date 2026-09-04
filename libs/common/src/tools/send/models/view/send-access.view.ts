// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SendAccessView as SdkSendAccessView } from "@bitwarden/sdk-internal";

import { View } from "../../../../models/view/view";
import { SendType } from "../../types/send-type";
import { SEND_TYPE_FROM_SDK } from "../domain/send";
import { SendAccess } from "../domain/send-access";

import { SendFileView } from "./send-file.view";
import { SendTextView } from "./send-text.view";

export class SendAccessView implements View {
  id: string = null;
  name: string = null;
  type: SendType = null;
  text = new SendTextView();
  file = new SendFileView();
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
    view.type = SEND_TYPE_FROM_SDK[obj.type];
    view.text = SendTextView.fromSdk(obj.text);
    view.file = SendFileView.fromSdk(obj.file);
    view.expirationDate = obj.expirationDate ? new Date(obj.expirationDate) : null;
    view.creatorIdentifier = obj.creatorIdentifier;
    return view;
  }
}
