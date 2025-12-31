// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BaseResponse } from "./base.response";

export class MessageResponse implements BaseResponse {
  object: string;
  title: string;
  message: string | null;
  raw: string;
  noColor = false;
  toStderr = false;

  constructor(title: string, message: string | null, toStderr = false) {
    this.object = "message";
    this.title = title;
    this.message = message;
    this.toStderr = toStderr;
  }
}
