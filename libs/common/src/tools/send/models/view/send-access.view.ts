// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { View } from "../../../../models/view/view";
import { SendType } from "../../enums/send-type";
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
}
