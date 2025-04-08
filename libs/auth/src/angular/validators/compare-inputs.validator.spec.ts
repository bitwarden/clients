import { FormControl, FormGroup, ValidationErrors } from "@angular/forms";

import { compareInputs, ValidationGoal } from "./compare-inputs.validator";

describe("compareInputs", () => {
  let validationErrorsObj: ValidationErrors;

  beforeEach(() => {
    // Use a fresh object for each test so that a mutation in one test doesn't affect another test
    validationErrorsObj = {
      compareInputsError: {
        message: "Custom error message",
      },
    };
  });

  it("should throw an error if compareInputs is not being applied to a FormGroup", () => {
    // Arrange
    const notAFormGroup = new FormControl("form-control");

    // Act
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

  it("should throw an error if either control is not found", () => {
    // Arrange
    const formGroupMissingControl = new FormGroup({
      ctrlA: new FormControl("content"),
    });

    // Act
    const validatorFn = compareInputs(
      ValidationGoal.InputsShouldMatch,
      "ctrlA",
      "ctrlB", // ctrlB is missing above
      "Custom error message",
    );

    // Assert
    expect(() => validatorFn(formGroupMissingControl)).toThrow(
      "[compareInputs validator] one or both of the specified controls could not be found in the form group",
    );
  });

  it("should throw an error if the name of one of the form controls is incorrect or mispelled", () => {
    // Arrange
    const formGroupMissingControl = new FormGroup({
      ctrlA: new FormControl("content"),
      ctrlB: new FormControl("content"),
    });

    // Act
    const validatorFn = compareInputs(
      ValidationGoal.InputsShouldMatch,
      "ctrlA",
      "ctrlC", // ctrlC is incorrect (mimics a developer misspelling a form control name)
      "Custom error message",
    );

    // Assert
    expect(() => validatorFn(formGroupMissingControl)).toThrow(
      "[compareInputs validator] one or both of the specified controls could not be found in the form group",
    );
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

    const ctrlBSetErrorsSpy = jest.spyOn(formGroup.controls.ctrlB, "setErrors");

    // Act
    const validatorFn = compareInputs(
      ValidationGoal.InputsShouldMatch,
      "ctrlA",
      "ctrlB",
      "Custom error message",
    );

    validatorFn(formGroup);

    // Assert
    expect(ctrlBSetErrorsSpy).toHaveBeenCalledWith(validationErrorsObj);
  });

  it("should call setErrors() on ctrlA if validation fails and 'showErrorOn' is set to 'controlA'", () => {
    // Arrange
    const formGroup = new FormGroup({
      ctrlA: new FormControl("apple"),
      ctrlB: new FormControl("banana"),
    });

    const ctrlASetErrorsSpy = jest.spyOn(formGroup.controls.ctrlA, "setErrors");
    const ctrlBSetErrorsSpy = jest.spyOn(formGroup.controls.ctrlB, "setErrors");

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
    expect(ctrlASetErrorsSpy).toHaveBeenCalledWith(validationErrorsObj);
    expect(ctrlBSetErrorsSpy).not.toHaveBeenCalled();
  });

  it("should not call setErrors() on ctrlB if validation passes and there is not a pre-existing error on ctrlB", () => {
    // Arrange
    const formGroup = new FormGroup({
      ctrlA: new FormControl("apple"),
      ctrlB: new FormControl("apple"),
    });

    const ctrlBSetErrorsSpy = jest.spyOn(formGroup.controls.ctrlB, "setErrors");

    // Act
    const validatorFn = compareInputs(
      ValidationGoal.InputsShouldMatch,
      "ctrlA",
      "ctrlB",
      "Custom error message",
    );

    validatorFn(formGroup);

    // Assert
    expect(ctrlBSetErrorsSpy).not.toHaveBeenCalled();
  });

  it("should call setErrors(null) on ctrlB if validation passes and there is a pre-existing error on ctrlB", () => {
    // Arrange
    const formGroup = new FormGroup({
      ctrlA: new FormControl("apple"),
      ctrlB: new FormControl("apple"),
    });

    const ctrlBSetErrorsSpy = jest.spyOn(formGroup.controls.ctrlB, "setErrors");

    formGroup.controls.ctrlB.setErrors(validationErrorsObj); // the pre-existing error

    // Act
    const validatorFn = compareInputs(
      ValidationGoal.InputsShouldMatch,
      "ctrlA",
      "ctrlB",
      "Custom error message",
    );

    validatorFn(formGroup);

    // Assert
    expect(ctrlBSetErrorsSpy).toHaveBeenCalledWith(null);
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
