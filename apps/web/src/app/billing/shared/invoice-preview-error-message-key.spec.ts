import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

import { invoicePreviewErrorMessageKey } from "./invoice-preview-error-message-key";

const addressMessage =
  "Your location wasn't recognized. Please ensure your country and postal code are valid and try again.";

describe("invoicePreviewErrorMessageKey", () => {
  it("returns the address key for a 400 keyed BillingAddress", () => {
    const error = new ErrorResponse(
      {
        Message: "The model state is invalid.",
        ValidationErrors: { BillingAddress: [addressMessage] },
      },
      400,
    );

    expect(invoicePreviewErrorMessageKey(error)).toBe("billingPreviewInvalidAddressError");
  });

  it("returns the address key for a 400 keyed with a BillingAddress.* sub-field", () => {
    const error = new ErrorResponse(
      {
        Message: "The model state is invalid.",
        ValidationErrors: { "BillingAddress.PostalCode": ["The PostalCode field is required."] },
      },
      400,
    );

    expect(invoicePreviewErrorMessageKey(error)).toBe("billingPreviewInvalidAddressError");
  });

  it("matches the BillingAddress key case-insensitively", () => {
    const error = new ErrorResponse(
      {
        Message: "The model state is invalid.",
        ValidationErrors: { billingAddress: [addressMessage] },
      },
      400,
    );

    expect(invoicePreviewErrorMessageKey(error)).toBe("billingPreviewInvalidAddressError");
  });

  it("unwraps an ErrorResponse carried on cause", () => {
    const cause = new ErrorResponse(
      {
        Message: "The model state is invalid.",
        ValidationErrors: { BillingAddress: [addressMessage] },
      },
      400,
    );

    expect(invoicePreviewErrorMessageKey(Object.assign(new Error("wrapped"), { cause }))).toBe(
      "billingPreviewInvalidAddressError",
    );
  });

  it("returns the generic key for a 400 without a BillingAddress key", () => {
    const error = new ErrorResponse(
      { Message: "Password Manager seats must be between 1 and 100,000." },
      400,
    );

    expect(invoicePreviewErrorMessageKey(error)).toBe("invoicePreviewErrorMessage");
  });

  it("returns the generic key for a non-400 ErrorResponse", () => {
    const error = new ErrorResponse(
      {
        Message: "The model state is invalid.",
        ValidationErrors: { BillingAddress: [addressMessage] },
      },
      500,
    );

    expect(invoicePreviewErrorMessageKey(error)).toBe("invoicePreviewErrorMessage");
  });

  it("returns the generic key for a non-ErrorResponse error", () => {
    expect(invoicePreviewErrorMessageKey(new Error("network"))).toBe("invoicePreviewErrorMessage");
  });
});
