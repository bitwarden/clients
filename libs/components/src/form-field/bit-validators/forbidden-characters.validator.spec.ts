// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { FormControl } from "@angular/forms";

import { forbiddenCharacters } from "./forbidden-characters.validator";

describe("forbiddenCharacters", () => {
  it("should return no error when input is null", () => {
    const input = createControl(null);
    const validate = forbiddenCharacters(["n", "u", "l", "l"]);

    const errors = validate(input);

    expect(errors).toBe(null);
  });

  it("should return no error when no characters are forbidden", () => {
    const input = createControl("special characters: \\/@#$%^&*()");
    const validate = forbiddenCharacters([]);

    const errors = validate(input);

    expect(errors).toBe(null);
  });

  it("should return no error when input does not contain forbidden characters", () => {
    const input = createControl("contains no special characters");
    const validate = forbiddenCharacters(["\\", "/", "@", "#", "$", "%", "^", "&", "*", "(", ")"]);

    const errors = validate(input);

    expect(errors).toBe(null);
  });

  it("should return error when input contains forbidden characters", () => {
    const input = createControl("contains / illegal @ characters");
    const validate = forbiddenCharacters(["\\", "/", "@", "#", "$", "%", "^", "&", "*", "(", ")"]);

    const errors = validate(input);

    expect(errors).not.toBe(null);
  });
});

function createControl(input: string) {
  return new FormControl(input);
}
