// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BaseResponse } from "./base.response";

export class ErrorResponse extends BaseResponse {
  message: string;
  validationErrors: { [key: string]: string[] };
  statusCode: number;

  constructor(response: any, status: number, identityResponse?: boolean) {
    super(response);
    let errorModel = null;
    if (response != null) {
      const responseErrorModel = this.getResponseProperty("ErrorModel");
      if (responseErrorModel && identityResponse) {
        errorModel = responseErrorModel;
      } else {
        errorModel = response;
      }
    }

    if (status === 429) {
      this.message = "Rate limit exceeded. Try again later.";
    } else if (errorModel) {
      this.message = this.getResponseProperty("Message", errorModel);
      this.validationErrors = this.getResponseProperty("ValidationErrors", errorModel);
    }
    this.statusCode = status;
  }

  /**
   * The stable, localizable validation errors from an RFC 7807 problem-details body.
   *
   * Newer server endpoints surface 400 failures as
   * `{ errors: { "<property>": [{ type, detail }] } }` (server `BitwardenValidationProblem`),
   * distinct from the legacy `validationErrors` (`{ "<property>": string[] }`) shape.
   * Returns a flat list of `{ type, detail }` across all properties, or `[]` when absent.
   */
  getValidationProblemErrors(): { type: string; detail: string }[] {
    const errors = this.getResponseProperty("Errors"); // case-insensitive -> matches `errors`
    if (errors == null || typeof errors !== "object") {
      return [];
    }
    const result: { type: string; detail: string }[] = [];
    for (const key in errors) {
      if (!Object.prototype.hasOwnProperty.call(errors, key) || !Array.isArray(errors[key])) {
        continue;
      }
      for (const entry of errors[key]) {
        if (entry != null && typeof entry.type === "string") {
          result.push({
            type: entry.type,
            detail: typeof entry.detail === "string" ? entry.detail : "",
          });
        }
      }
    }
    return result;
  }

  getSingleMessage(): string {
    if (this.validationErrors == null) {
      return this.message;
    }
    for (const key in this.validationErrors) {
      // eslint-disable-next-line
      if (!this.validationErrors.hasOwnProperty(key)) {
        continue;
      }
      if (this.validationErrors[key].length) {
        return this.validationErrors[key][0];
      }
    }
    return this.message;
  }

  getAllMessages(): string[] {
    const messages: string[] = [];
    if (this.validationErrors == null) {
      return messages;
    }
    for (const key in this.validationErrors) {
      // eslint-disable-next-line
      if (!this.validationErrors.hasOwnProperty(key)) {
        continue;
      }
      this.validationErrors[key].forEach((item: string) => {
        let prefix = "";
        if (key.indexOf("[") > -1 && key.indexOf("]") > -1) {
          const lastSep = key.lastIndexOf(".");
          prefix = key.substr(0, lastSep > -1 ? lastSep : key.length) + ": ";
        }
        messages.push(prefix + item);
      });
    }
    return messages;
  }
}
