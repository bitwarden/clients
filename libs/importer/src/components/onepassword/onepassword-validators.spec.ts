import { FormControl } from "@angular/forms";

import { subdomainWithMessage, trimmedEmailWithMessage } from "./onepassword-validators";

describe("trimmedEmailWithMessage", () => {
  const validate = (value: string) => trimmedEmailWithMessage("bad email")(new FormControl(value));

  it.each(["user@example.com", " user@example.com ", ""])("accepts %j", (value) => {
    expect(validate(value)).toBeNull();
  });

  it("refuses an incomplete address", () => {
    expect(validate("user@")).toEqual({ trimmedEmail: { message: "bad email" } });
  });
});

describe("subdomainWithMessage", () => {
  const validate = (value: string) => subdomainWithMessage("bad address")(new FormControl(value));

  it.each(["my", " Acme-Corp ", ""])("accepts %j", (value) => {
    expect(validate(value)).toBeNull();
  });

  it.each(["acme.1password.com", "-acme", "acme-"])("refuses %j", (value) => {
    expect(validate(value)).toEqual({ subdomain: { message: "bad address" } });
  });
});
