// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendAccessView } from "@bitwarden/common/tools/send/models/view/send-access.view";

import { BaseResponse } from "../../../models/response/base.response";

import { SendFileResponse } from "./send-file.response";
import { SendTextResponse } from "./send-text.response";

export class SendAccessResponse implements BaseResponse {
  static template(): SendAccessResponse {
    const req = new SendAccessResponse();
    req.name = "Send name";
    req.type = SendType.Text;
    req.text = null;
    req.file = null;
    return req;
  }

  object = "send-access";
  id: string;
  name: string;
  type: SendType;
  text: SendTextResponse;
  file: SendFileResponse;

  constructor(o?: SendAccessView) {
    if (o == null) {
      return;
    }
    this.id = o.id;
    this.name = o.name;
    this.type = o.type;

    if (o.type === SendType.Text && o.text != null) {
      this.text = new SendTextResponse(o.text);
    }
    if (o.type === SendType.File && o.file != null) {
      this.file = new SendFileResponse(o.file);
    }
  }
}
