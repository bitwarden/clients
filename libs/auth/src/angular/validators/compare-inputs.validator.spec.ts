import { FormControl, FormGroup, ValidationErrors } from "@angular/forms";

import { compareInputs, ValidationGoal } from "./compare-inputs.validator";

const validationErrorsObj: ValidationErrors = {
  compareInputsError: {
    message: "Custom error message",
  },
};

describe("compareInputs", () => {
  it("should throw an error if compareInputs is not being applied to a FormGroup", () => {
    const notAFormGroup = new FormControl("form-control");

    const validatorFn = compareInputs(
      ValidationGoal.InputsShouldMatch,
      "ctrlA",
      "ctrlB",
      "Custom error message",
    );

    // Assert
    expect(() => validatorFn(notAFormGroup)).toThrow(
      "compareInputs only supports validation at the FormGroup level",
    );
  });

  it("should return null if either control is not found", () => {
    // Arrange
    const formGroup = new FormGroup({
      ctrlA: new FormControl("content"),
    });

    // Act
    const validatorFn = compareInputs(
      ValidationGoal.InputsShouldMatch,
      "ctrlA",
      "ctrlB", // ctrlB is missing above
      "Custom error message",
    );

    const result = validatorFn(formGroup);

    // Assert
    expect(result).toBeNull();
  });

  it("should return null if both controls have empty string values", () => {
    // Arrange
    const formGroup = new FormGroup({
      ctrlA: new FormControl(""),
      ctrlB: new FormControl(""),
    });

    // Act
    const validatorFn = compareInputs(
      ValidationGoal.InputsShouldMatch,
      "ctrlA",
      "ctrlB",
      "Custom error message",
    );

    const result = validatorFn(formGroup);

    // Assert
    expect(result).toBeNull();
  });

  it("should call setErrors() on ctrlB if validation fails", () => {
    // Arrange
    const formGroup = new FormGroup({
      ctrlA: new FormControl("apple"),
      ctrlB: new FormControl("banana"),
    });

    jest.spyOn(formGroup.controls.ctrlB, "setErrors");

    // Act
    const validatorFn = compareInputs(
      ValidationGoal.InputsShouldMatch,
      "ctrlA",
      "ctrlB",
      "Custom error message",
    );

    validatorFn(formGroup);

    // Assert
    expect(formGroup.controls.ctrlB.setErrors).toHaveBeenCalledWith(validationErrorsObj);
  });

  it("should call setErrors() on ctrlA if validation fails and 'showErrorOn' is set to 'controlA'", () => {
    // Arrange
    const formGroup = new FormGroup({
      ctrlA: new FormControl("apple"),
      ctrlB: new FormControl("banana"),
    });

    jest.spyOn(formGroup.controls.ctrlA, "setErrors");
    jest.spyOn(formGroup.controls.ctrlB, "setErrors");

    // Act
    const validatorFn = compareInputs(
      ValidationGoal.InputsShouldMatch,
      "ctrlA",
      "ctrlB",
      "Custom error message",
      "controlA",
    );

    validatorFn(formGroup);

    // Assert
    expect(formGroup.controls.ctrlA.setErrors).toHaveBeenCalledWith(validationErrorsObj);
    expect(formGroup.controls.ctrlB.setErrors).not.toHaveBeenCalled();
  });

  const cases = [
    {
      expected: null,
      goal: ValidationGoal.InputsShouldMatch,
      matchStatus: "match",
      values: { ctrlA: "apple", ctrlB: "apple" },
    },
    {
      expected: "a ValidationErrors object",
      goal: ValidationGoal.InputsShouldMatch,
      matchStatus: "do not match",
      values: { ctrlA: "apple", ctrlB: "banana" },
    },
    {
      expected: null,
      goal: ValidationGoal.InputsShouldNotMatch,
      matchStatus: "do not match",
      values: { ctrlA: "apple", ctrlB: "banana" },
    },
    {
      expected: "a ValidationErrors object",
      goal: ValidationGoal.InputsShouldNotMatch,
      matchStatus: "match",
      values: { ctrlA: "apple", ctrlB: "apple" },
    },
  ];

  cases.forEach(({ goal, expected, matchStatus, values }) => {
    const goalString =
      goal === ValidationGoal.InputsShouldMatch ? "InputsShouldMatch" : "InputsShouldNotMatch";

    it(`should return ${expected} if the goal is ${goalString} and the inputs ${matchStatus}`, () => {
      // Arrange
      const formGroup = new FormGroup({
        ctrlA: new FormControl(values.ctrlA),
        ctrlB: new FormControl(values.ctrlB),
      });

      // Act
      const validatorFn = compareInputs(goal, "ctrlA", "ctrlB", "Custom error message");

      const result = validatorFn(formGroup);

      // Assert
      expect(result).toEqual(expected === null ? null : validationErrorsObj);
    });
  });
});
