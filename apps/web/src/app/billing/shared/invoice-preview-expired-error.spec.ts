import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

import { isInvoicePreviewExpiredError } from "./invoice-preview-expired-error";

const expired = (key = "InvoicePreviewExpired", status = 400) =>
  new ErrorResponse(
    {
      Message: "The model state is invalid.",
      ValidationErrors: { [key]: ["Your invoice preview is out of date."] },
    },
    status,
  );

describe("isInvoicePreviewExpiredError", () => {
  it("recognizes a 400 keyed InvoicePreviewExpired", () =>
    expect(isInvoicePreviewExpiredError(expired())).toBe(true));

  it("matches the key case-insensitively", () =>
    expect(isInvoicePreviewExpiredError(expired("invoicePreviewExpired"))).toBe(true));

  it("unwraps an ErrorResponse on error.cause", () =>
    expect(isInvoicePreviewExpiredError({ cause: expired() })).toBe(true));

  it("ignores the key on a non-400", () =>
    expect(isInvoicePreviewExpiredError(expired("InvoicePreviewExpired", 500))).toBe(false));

  it("ignores a 400 keyed BillingAddress", () =>
    expect(isInvoicePreviewExpiredError(expired("BillingAddress"))).toBe(false));

  it("ignores non-ErrorResponse errors", () =>
    expect(isInvoicePreviewExpiredError(new Error("x"))).toBe(false));
});
