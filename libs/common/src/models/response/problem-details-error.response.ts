import { ErrorResponse } from "./error.response";

export type ProblemDetail = { type: string; detail: string };

export class ProblemDetailsErrorResponse extends ErrorResponse {
  readonly errors: Record<string, ProblemDetail[]>;

  constructor(response: any, status: number) {
    super(response, status);
    this.errors = this.getResponseProperty("errors") ?? {};
  }
}
