import { AbstractControl, FormControl, ValidationErrors } from "@angular/forms";

import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";

import {
  inputEmailLimitValidator,
  orgSeatLimitReachedValidator,
} from "./org-seat-limit-reached.validator";

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

describe("orgSeatLimitReachedValidator", () => {
  let organization: Organization;
  let allOrganizationUserEmails: string[];
  let validatorFn: (control: AbstractControl) => ValidationErrors | null;

  beforeEach(() => {
    allOrganizationUserEmails = ["user1@example.com"];
  });

  it("should return null when control value is empty", () => {
    validatorFn = orgSeatLimitReachedValidator(
      organization,
      allOrganizationUserEmails,
      "You cannot invite more than 2 members without upgrading your plan.",
    );
    const control = new FormControl("");

    const result = validatorFn(control);

    expect(result).toBeNull();
  });

  it("should return null when control value is null", () => {
    validatorFn = orgSeatLimitReachedValidator(
      organization,
      allOrganizationUserEmails,
      "You cannot invite more than 2 members without upgrading your plan.",
    );
    const control = new FormControl(null);

    const result = validatorFn(control);

    expect(result).toBeNull();
  });

  it("should return null when max seats are not exceeded on free plan", () => {
    organization = orgFactory({
      productTierType: ProductTierType.Free,
      seats: 2,
    });
    validatorFn = orgSeatLimitReachedValidator(
      organization,
      allOrganizationUserEmails,
      "You cannot invite more than 2 members without upgrading your plan.",
    );
    const control = new FormControl("user2@example.com");

    const result = validatorFn(control);

    expect(result).toBeNull();
  });

  it("should return null when max seats are not exceeded on teams starter plan", () => {
    organization = orgFactory({
      productTierType: ProductTierType.TeamsStarter,
      seats: 10,
    });
    validatorFn = orgSeatLimitReachedValidator(
      organization,
      allOrganizationUserEmails,
      "You cannot invite more than 10 members without upgrading your plan.",
    );
    const control = new FormControl(
      "user2@example.com," +
        "user3@example.com," +
        "user4@example.com," +
        "user5@example.com," +
        "user6@example.com," +
        "user7@example.com," +
        "user8@example.com," +
        "user9@example.com," +
        "user10@example.com",
    );

    const result = validatorFn(control);

    expect(result).toBeNull();
  });

  it("should return validation error when max seats are exceeded on free plan", () => {
    organization = orgFactory({
      productTierType: ProductTierType.Free,
      seats: 2,
    });
    const errorMessage = "You cannot invite more than 2 members without upgrading your plan.";
    validatorFn = orgSeatLimitReachedValidator(
      organization,
      allOrganizationUserEmails,
      "You cannot invite more than 2 members without upgrading your plan.",
    );
    const control = new FormControl("user2@example.com,user3@example.com");

    const result = validatorFn(control);

    expect(result).toStrictEqual({ seatLimitReached: { message: errorMessage } });
  });

  it("should return null when not on free plan", () => {
    const control = new FormControl("user2@example.com,user3@example.com");
    organization = orgFactory({
      productTierType: ProductTierType.Enterprise,
      seats: 100,
    });
    validatorFn = orgSeatLimitReachedValidator(
      organization,
      allOrganizationUserEmails,
      "You cannot invite more than 2 members without upgrading your plan.",
    );

    const result = validatorFn(control);

    expect(result).toBeNull();
  });
});

describe("inputEmailLimitValidator", () => {
  const getErrorMessage = (max: number) => `You can only add up to ${max} unique emails.`;

  const createUniqueEmailString = (numberOfEmails: number) => {
    let result = "";

    for (let i = 1; i <= numberOfEmails; i++) {
      result += `test${i}@test.com, `;
    }

    // Remove the last comma and space
    result = result.slice(0, -1);

    return result;
  };

  describe("TeamsStarter limit validation", () => {
    const teamsStarterOrganization = orgFactory({
      productTierType: ProductTierType.TeamsStarter,
      seats: 10,
    });

    it("should return null if unique email count is within the limit", () => {
      // Arrange
      const control = new FormControl("test1@test.com, test2@test.com, test3@test.com");

      const validatorFn = inputEmailLimitValidator(teamsStarterOrganization, getErrorMessage);

      // Act
      const result = validatorFn(control);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null if unique email count is equal the limit", () => {
      // Arrange
      const control = new FormControl(
        "test1@test.com, test2@test.com, test3@test.com, test4@test.com, test5@test.com, test6@test.com, test7@test.com, test8@test.com, test9@test.com, test10@test.com",
      );

      const validatorFn = inputEmailLimitValidator(teamsStarterOrganization, getErrorMessage);

      // Act
      const result = validatorFn(control);

      // Assert
      expect(result).toBeNull();
    });

    it("should return an error if unique email count exceeds the limit", () => {
      // Arrange
      const control = new FormControl(createUniqueEmailString(11));

      const validatorFn = inputEmailLimitValidator(teamsStarterOrganization, getErrorMessage);

      // Act
      const result = validatorFn(control);

      // Assert
      expect(result).toEqual({
        tooManyEmails: { message: "You can only add up to 10 unique emails." },
      });
    });
  });

  describe("none TeamsStarter limit validation", () => {
    const noneTeamsStarterOrganization = orgFactory({
      productTierType: ProductTierType.Enterprise,
      seats: 100,
    });

    it("should return null if unique email count is within the limit", () => {
      // Arrange
      const control = new FormControl("test1@test.com, test2@test.com, test3@test.com");

      const validatorFn = inputEmailLimitValidator(noneTeamsStarterOrganization, getErrorMessage);

      // Act
      const result = validatorFn(control);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null if unique email count is equal the limit", () => {
      // Arrange
      const control = new FormControl(
        "test1@test.com, test2@test.com, test3@test.com, test4@test.com, test5@test.com, test6@test.com, test7@test.com, test8@test.com, test9@test.com, test10@test.com",
      );

      const validatorFn = inputEmailLimitValidator(noneTeamsStarterOrganization, getErrorMessage);

      // Act
      const result = validatorFn(control);

      // Assert
      expect(result).toBeNull();
    });

    it("should return an error if unique email count exceeds the limit", () => {
      // Arrange

      const control = new FormControl(createUniqueEmailString(21));

      const validatorFn = inputEmailLimitValidator(noneTeamsStarterOrganization, getErrorMessage);

      // Act
      const result = validatorFn(control);

      // Assert
      expect(result).toEqual({
        tooManyEmails: { message: "You can only add up to 20 unique emails." },
      });
    });
  });

  describe("input email validation", () => {
    const organization = orgFactory({
      productTierType: ProductTierType.Enterprise,
      seats: 100,
    });

    it("should ignore duplicate emails and validate only unique ones", () => {
      // Arrange

      const sixUniqueEmails = createUniqueEmailString(6);
      const sixDuplicateEmails =
        "test1@test.com,test1@test.com,test1@test.com,test1@test.com,test1@test.com,test1@test.com";

      const control = new FormControl(sixUniqueEmails + sixDuplicateEmails);
      const validatorFn = inputEmailLimitValidator(organization, getErrorMessage);

      // Act
      const result = validatorFn(control);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null if input is null", () => {
      // Arrange
      const control: AbstractControl = new FormControl(null);

      const validatorFn = inputEmailLimitValidator(organization, getErrorMessage);

      // Act
      const result = validatorFn(control);

      // Assert
      expect(result).toBeNull();
    });

    it("should return null if input is empty", () => {
      // Arrange
      const control: AbstractControl = new FormControl("");

      const validatorFn = inputEmailLimitValidator(organization, getErrorMessage);

      // Act
      const result = validatorFn(control);

      // Assert
      expect(result).toBeNull();
    });
  });
});
