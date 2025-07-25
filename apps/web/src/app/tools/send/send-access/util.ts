import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

export function isErrorResponse(value: unknown): value is ErrorResponse {
  return value instanceof ErrorResponse;
}
