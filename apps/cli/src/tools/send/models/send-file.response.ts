// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SendFileView } from "@bitwarden/common/tools/send/models/view/send-file.view";

export class SendFileResponse {
  static template(fileName = "file attachment location"): SendFileResponse {
    const req = new SendFileResponse();
    req.fileName = fileName;
    return req;
  }

  static toView(file: SendFileResponse, view = new SendFileView()) {
    if (file == null) {
      return null;
    }

    view.id = file.id;
    view.size = file.size;
    view.sizeName = file.sizeName;
    view.fileName = file.fileName;
    return view;
  }

  id: string;
  size: string;
  sizeName: string;
  fileName: string;

  constructor(o?: SendFileView) {
    if (o == null) {
      return;
    }
    this.id = o.id;
    this.size = o.size;
    this.sizeName = o.sizeName;
    this.fileName = o.fileName;
  }
}
