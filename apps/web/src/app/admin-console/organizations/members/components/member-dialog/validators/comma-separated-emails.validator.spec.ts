// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { FormControl } from "@angular/forms";

import { commaSeparatedEmails } from "./comma-separated-emails.validator";

describe("commaSeparatedEmails", () => {
  it("should return no error when input is valid", () => {
    const input = createControl(null);
    input.setValue("user@bitwarden.com");
    const errors = commaSeparatedEmails(input);

    expect(errors).toBe(null);
  });

  it("should return no error when a single valid email is provided", () => {
    const input = createControl("user@bitwarden.com");
    const errors = commaSeparatedEmails(input);

    expect(errors).toBe(null);
  });

  it("should return no error when input has valid emails separated by commas", () => {
    const input = createControl("user@bitwarden.com, user1@bitwarden.com, user@bitwarden.com");
    const errors = commaSeparatedEmails(input);

    expect(errors).toBe(null);
  });

  it("should return error when input is invalid", () => {
    const input = createControl("lksjflks");

    const errors = commaSeparatedEmails(input);

    expect(errors).not.toBe(null);
  });

  it("should return error when input contains invalid emails", () => {
    const input = createControl("user@bitwarden.com, nonsfonwoei, user1@bitwarden.com");
    const errors = commaSeparatedEmails(input);

    expect(errors).not.toBe(null);
  });
});

function createControl(input: string) {
  return new FormControl(input);
}
