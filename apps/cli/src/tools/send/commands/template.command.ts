import { SendType } from "@bitwarden/common/tools/send/enums/send-type";

import { Response } from "../../../models/response";
import { TemplateResponse } from "../../../models/response/template.response";
import { SendResponse } from "../models/send.response";

export class SendTemplateCommand {
  constructor() {}

  run(type: string): Response {
    let template: SendResponse | undefined;
    let response: Response;

    switch (type) {
      case "send.text":
      case "text":
        template = SendResponse.template(SendType.Text);
        break;
      case "send.file":
      case "file":
        template = SendResponse.template(SendType.File);
        break;
      default:
        response = Response.badRequest("Unknown template object.");
    }

    if (template) {
      response = Response.success(new TemplateResponse(template));
    }

    response ??= Response.badRequest("An error occurred while retrieving the template.");

    return response;
  }
}
