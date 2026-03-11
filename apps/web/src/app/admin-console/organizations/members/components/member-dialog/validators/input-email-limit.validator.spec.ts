import { AbstractControl, FormControl } from "@angular/forms";

import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";

import {
  getEmailBatchLimit,
  inputEmailLimitValidator,
  isDynamicSeatPlan,
  isFixedSeatPlan,
} from "./input-email-limit.validator";

const orgFactory = (props: Partial<Organization> = {}) =>
  Object.assign(
    new Organization(),
    {
      id: "myOrgId",
      enabled: true,
      type: OrganizationUserType.Admin,
    },
    props,
  );

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

  describe("existingEmails exclusion", () => {
    it("should not count existing member emails toward the limit", () => {
      // Arrange — limit is 0 (org at full capacity), but the input email is already a member
      const existingEmail = "existing@example.com";
      const control = new FormControl(existingEmail);
      const validatorFn = inputEmailLimitValidator(0, getErrorMessage, [existingEmail]);

      // Act
      const result = validatorFn(control);

      // Assert — re-inviting an existing member should be allowed even when limit is 0
      expect(result).toBeNull();
    });

    it("should count non-member emails toward the limit", () => {
      // Arrange — limit is 1, input contains 1 existing member + 1 new address
      const existingEmail = "existing@example.com";
      const control = new FormControl(`${existingEmail}, new1@example.com, new2@example.com`);
      const validatorFn = inputEmailLimitValidator(1, getErrorMessage, [existingEmail]);

      // Act
      const result = validatorFn(control);

      // Assert — 2 new emails exceed limit of 1
      expect(result).toEqual({
        tooManyEmails: { message: "You can only add up to 1 unique emails." },
      });
    });

    it("should pass when only new emails are within the limit", () => {
      // Arrange — limit is 2, input has 3 emails but 2 are existing members
      const existingEmails = ["existing1@example.com", "existing2@example.com"];
      const control = new FormControl(
        `${existingEmails[0]}, ${existingEmails[1]}, new@example.com`,
      );
      const validatorFn = inputEmailLimitValidator(2, getErrorMessage, existingEmails);

      // Act
      const result = validatorFn(control);

      // Assert — only 1 new email, within limit of 2
      expect(result).toBeNull();
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

describe("getEmailBatchLimit", () => {
  describe("dynamic-seat plan", () => {
    it("returns 20 regardless of occupied seat count", () => {
      const organization = orgFactory({ productTierType: ProductTierType.Teams, seats: 100 });

      expect(getEmailBatchLimit(organization, 0)).toBe(20);
      expect(getEmailBatchLimit(organization, 99)).toBe(20);
      expect(getEmailBatchLimit(organization, 150)).toBe(20);
    });
  });

  describe("fixed-seat plan", () => {
    it("returns 20 when available seats exceed the batch limit", () => {
      const organization = orgFactory({ productTierType: ProductTierType.Free, seats: 100 });

      expect(getEmailBatchLimit(organization, 0)).toBe(20);
    });

    it("returns remaining seats (seats minus occupied) when below the batch limit", () => {
      const organization = orgFactory({ productTierType: ProductTierType.Free, seats: 10 });

      expect(getEmailBatchLimit(organization, 3)).toBe(7);
    });

    it("returns 0 when oversubscribed", () => {
      const organization = orgFactory({ productTierType: ProductTierType.Free, seats: 6 });

      expect(getEmailBatchLimit(organization, 6)).toBe(0);
      expect(getEmailBatchLimit(organization, 8)).toBe(0);
    });
  });
});

describe("isFixedSeatPlan", () => {
  test.each([
    [true, ProductTierType.Free],
    [true, ProductTierType.Families],
    [true, ProductTierType.TeamsStarter],
    [false, ProductTierType.Enterprise],
  ])("should return %s for %s", (expected, input) => {
    expect(isFixedSeatPlan(input)).toBe(expected);
  });
});

describe("isDynamicSeatPlan", () => {
  test.each([
    [true, ProductTierType.Enterprise],
    [true, ProductTierType.Teams],
    [false, ProductTierType.Free],
    [false, ProductTierType.Families],
    [false, ProductTierType.TeamsStarter],
  ])("should return %s for %s", (expected, input) => {
    expect(isDynamicSeatPlan(input)).toBe(expected);
  });
});
