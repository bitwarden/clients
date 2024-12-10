// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BaseResponse } from "./response/base.response";

export class Response {
  static error(error: any, data?: any): Response {
    const res = new Response();
    res.success = false;
    if (typeof error === "string") {
      res.message = error;
    } else {
      res.message =
        error.message != null
          ? error.message
          : error.toString() === "[object Object]"
            ? JSON.stringify(error)
            : error.toString();
    }
    res.data = data;
    return res;
  }

  static notFound(): Response {
    return Response.error("Not found.");
  }

  static badRequest(message: string): Response {
    return Response.error(message);
  }

  static multipleResults(ids: string[]): Response {
    let msg =
      "More than one result was found. Try getting a specific object by `id` instead. " +
      "The following objects were found:";
    ids.forEach((id) => {
      msg += "\n" + id;
    });
    return Response.error(msg, ids);
  }

  static success(data?: BaseResponse): Response {
    const res = new Response();
    res.success = true;
    res.data = data;
    return res;
  }

  success: boolean;
  message: string;
  errorCode: number;
  data: BaseResponse;
}
