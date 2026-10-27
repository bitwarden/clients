import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

const expiredKey = "invoicepreviewexpired";

// A 400 keyed InvoicePreviewExpired means the quote the client holds is stale and must be refreshed.
export function isInvoicePreviewExpiredError(error: unknown): boolean {
  // The resource wraps a non-Error rejection (ErrorResponse isn't an Error) and puts the
  // original on `cause`, so unwrap that before inspecting the status.
  const response =
    error instanceof ErrorResponse ? error : (error as { cause?: unknown } | undefined)?.cause;

  if (!(response instanceof ErrorResponse) || response.statusCode !== 400) {
    return false;
  }

  return Object.keys(response.validationErrors ?? {}).some(
    (key) => key.toLowerCase() === expiredKey,
  );
}
