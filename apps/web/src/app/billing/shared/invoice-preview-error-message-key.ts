import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

const billingAddressKey = "billingaddress";

// A 400 keyed BillingAddress (or BillingAddress.*) means the server rejected the billing address.
// Any other error, including a 400 about other inputs, is a generic preview failure.
export function invoicePreviewErrorMessageKey(
  error: unknown,
): "billingPreviewInvalidAddressError" | "invoicePreviewErrorMessage" {
  // The resource wraps a non-Error rejection (ErrorResponse isn't an Error) and puts the
  // original on `cause`, so unwrap that before inspecting the status.
  const response =
    error instanceof ErrorResponse ? error : (error as { cause?: unknown } | undefined)?.cause;

  if (!(response instanceof ErrorResponse) || response.statusCode !== 400) {
    return "invoicePreviewErrorMessage";
  }

  const isAddressError = Object.keys(response.validationErrors ?? {}).some((key) => {
    const lowerKey = key.toLowerCase();
    return lowerKey === billingAddressKey || lowerKey.startsWith(`${billingAddressKey}.`);
  });

  return isAddressError ? "billingPreviewInvalidAddressError" : "invoicePreviewErrorMessage";
}
