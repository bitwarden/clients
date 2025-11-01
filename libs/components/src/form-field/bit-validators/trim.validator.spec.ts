import { FormControl } from "@angular/forms";

import { trimValidator as validate } from "./trim.validator";

describe("trimValidator", () => {
  it("should not error when input is null", () => {
    const input = createControl(null);
    const errors = validate(input);

    expect(errors).toBe(null);
  });

  it("should not error when input is an empty string", () => {
    const input = createControl("");
    const errors = validate(input);

    expect(errors).toBe(null);
  });

  it("should not error when input has no whitespace", () => {
    const input = createControl("test value");
    const errors = validate(input);

    expect(errors).toBe(null);
  });

  it("should remove beginning whitespace", () => {
    const input = createControl(" test value");
    const errors = validate(input);

    expect(errors).toBe(null);
    expect(input.value).toBe("test value");
  });

  it("should remove trailing whitespace", () => {
    const input = createControl("test value ");
    const errors = validate(input);

    expect(errors).toBe(null);
    expect(input.value).toBe("test value");
  });

  it("should remove beginning and trailing whitespace", () => {
    const input = createControl(" test value ");
    const errors = validate(input);

    expect(errors).toBe(null);
    expect(input.value).toBe("test value");
  });

  it("should error when input is just whitespace", () => {
    const input = createControl(" ");
    const errors = validate(input);

    expect(errors).toEqual({ trim: { message: "input is only whitespace" } });
  });
});

function createControl(input: string | null) {
  return new FormControl(input);
}
