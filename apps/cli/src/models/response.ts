// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

import { BaseResponse } from "./response/base.response";

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof ErrorResponse) {
    const message = error.getSingleMessage();
    if (message) {
      return message;
    }
  }
  if (error instanceof Error) {
    return String(error);
  }
  if (error) {
    const errorWithMessage: { message?: unknown } = error; // To placate TypeScript.
    if (errorWithMessage.message && typeof errorWithMessage.message === "string") {
      return errorWithMessage.message;
    }
  }
  return JSON.stringify(error);
}

export class Response {
  static error(error: any, data?: any): Response {
    const res = new Response();
    res.success = false;
    res.message = getErrorMessage(error);
    res.data = data;
    return res;
  }

  static notFound(): Response {
    return Response.error("Not found.");
  }

  static noEditPermission(): Response {
    return Response.error("You do not have permission to edit this item");
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
