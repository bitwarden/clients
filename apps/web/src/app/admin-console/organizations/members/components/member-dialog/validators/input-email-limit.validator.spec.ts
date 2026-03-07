import { AbstractControl, FormControl } from "@angular/forms";

import { inputEmailLimitValidator } from "./input-email-limit.validator";

describe("inputEmailLimitValidator", () => {
  const getErrorMessage = (max: number) => `You can only add up to ${max} unique emails.`;

  const createUniqueEmailString = (numberOfEmails: number) =>
    Array(numberOfEmails)
      .fill(null)
      .map((_, i) => `email${i}@example.com`)
      .join(", ");

  const createIdenticalEmailString = (numberOfEmails: number) =>
    Array(numberOfEmails)
      .fill(null)
      .map(() => `email@example.com`)
      .join(", ");

  describe("10 email limit validation", () => {
    const emailLimit = 10;

    it("should return null if unique email count is within the limit", () => {
      // Arrange
      const control = new FormControl(createUniqueEmailString(3));

      const validatorFn = inputEmailLimitValidator(emailLimit, getErrorMessage);

      // Act
      const result = validatorFn(control);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null if unique email count is equal the limit", () => {
      // Arrange
      const control = new FormControl(createUniqueEmailString(10));

      const validatorFn = inputEmailLimitValidator(emailLimit, getErrorMessage);

      // Act
      const result = validatorFn(control);

      // Assert
      expect(result).toBeNull();
    });

    it("should return an error if unique email count exceeds the limit", () => {
      // Arrange
      const control = new FormControl(createUniqueEmailString(11));

      const validatorFn = inputEmailLimitValidator(emailLimit, getErrorMessage);

      // Act
      const result = validatorFn(control);

      // Assert
      expect(result).toEqual({
        tooManyEmails: { message: "You can only add up to 10 unique emails." },
      });
    });
  });

  describe("20 email limit validation", () => {
    const emailLimit = 20;

    it("should return null if unique email count is within the limit", () => {
      // Arrange
      const control = new FormControl(createUniqueEmailString(3));

      const validatorFn = inputEmailLimitValidator(emailLimit, getErrorMessage);

      // Act
      const result = validatorFn(control);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null if unique email count is equal the limit", () => {
      // Arrange
      const control = new FormControl(createUniqueEmailString(20));

      const validatorFn = inputEmailLimitValidator(emailLimit, getErrorMessage);

      // Act
      const result = validatorFn(control);

      // Assert
      expect(result).toBeNull();
    });

    it("should return an error if unique email count exceeds the limit", () => {
      // Arrange

      const control = new FormControl(createUniqueEmailString(21));

      const validatorFn = inputEmailLimitValidator(emailLimit, getErrorMessage);

      // Act
      const result = validatorFn(control);

      // Assert
      expect(result).toEqual({
        tooManyEmails: { message: "You can only add up to 20 unique emails." },
      });
    });
  });

  describe("input email validation", () => {
    const emailLimit = 20;

    it("should ignore duplicate emails and validate only unique ones", () => {
      // Arrange
      const sixUniqueEmails = createUniqueEmailString(6);
      const sixDuplicateEmails = createIdenticalEmailString(6);

      const control = new FormControl(sixUniqueEmails + sixDuplicateEmails);
      const validatorFn = inputEmailLimitValidator(emailLimit, getErrorMessage);

      // Act
      const result = validatorFn(control);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null if input is null", () => {
      // Arrange
      const control: AbstractControl = new FormControl(null);

      const validatorFn = inputEmailLimitValidator(emailLimit, getErrorMessage);

      // Act
      const result = validatorFn(control);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null if input is empty", () => {
      // Arrange
      const control: AbstractControl = new FormControl("");

      const validatorFn = inputEmailLimitValidator(emailLimit, getErrorMessage);

      // Act
      const result = validatorFn(control);

      // Assert
      expect(result).toBeNull();
    });
  });
});
