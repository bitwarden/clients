import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

const expiredKey = "invoicepreviewexpired";

// A 400 keyed InvoicePreviewExpired means the quote the client holds is stale and must be refreshed.
export function isInvoicePreviewExpiredError(error: unknown): boolean {
  if (!(error instanceof ErrorResponse) || error.statusCode !== 400) {
    return false;
  }

  return Object.keys(error.validationErrors ?? {}).some((key) => key.toLowerCase() === expiredKey);
}
