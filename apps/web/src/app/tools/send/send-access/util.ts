import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

import { SendContext } from "./types";

/** narrows a type to an `ErrorResponse` */
export function isErrorResponse(value: unknown): value is ErrorResponse {
  return value instanceof ErrorResponse;
}

/** narrows a type to a `SendContext` */
export function isSendContext(value: unknown): value is SendContext {
  return !!value && typeof value === "object" && "id" in value && "key" in value;
}
