import { FormControl } from "@angular/forms";

import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";

import {
  orgSeatLimitReachedValidator,
  isFixedSeatPlan,
  isDynamicSeatPlan,
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

describe("orgSeatLimitReachedValidator", () => {
  let organization: Organization;
  let allOrganizationUserEmails: string[];
  let occupiedSeatCount: number;

  beforeEach(() => {
    allOrganizationUserEmails = [createUniqueEmailString(1)];
    occupiedSeatCount = 1;
    organization = null;
  });

  it("should return null when control value is empty", () => {
    const validatorFn = orgSeatLimitReachedValidator(
      organization,
      allOrganizationUserEmails,
      "You cannot invite more than 2 members without upgrading your plan.",
      occupiedSeatCount,
    );
    const control = new FormControl("");

    const result = validatorFn(control);

    expect(result).toBeNull();
  });

  it("should return null when control value is null", () => {
    const validatorFn = orgSeatLimitReachedValidator(
      organization,
      allOrganizationUserEmails,
      "You cannot invite more than 2 members without upgrading your plan.",
      occupiedSeatCount,
    );
    const control = new FormControl(null);

    const result = validatorFn(control);

    expect(result).toBeNull();
  });

  it("should return null when on dynamic seat plan", () => {
    const control = new FormControl(createUniqueEmailString(1));
    const organization = orgFactory({
      productTierType: ProductTierType.Enterprise,
      seats: 100,
    });

    const validatorFn = orgSeatLimitReachedValidator(
      organization,
      allOrganizationUserEmails,
      "Enterprise plan dummy error.",
      occupiedSeatCount,
    );

    const result = validatorFn(control);

    expect(result).toBeNull();
  });

  it("should only count unique input email addresses", () => {
    const twoUniqueEmails = createUniqueEmailString(2);
    const sixDuplicateEmails = createIdenticalEmailString(6);
    const control = new FormControl(twoUniqueEmails + sixDuplicateEmails);
    const organization = orgFactory({
      productTierType: ProductTierType.Families,
      seats: 6,
    });

    const occupiedSeatCount = 3;
    const validatorFn = orgSeatLimitReachedValidator(
      organization,
      allOrganizationUserEmails,
      "Family plan dummy error.",
      occupiedSeatCount,
    );

    const result = validatorFn(control);

    expect(result).toBeNull();
  });

  describe("when total occupied seat count is below plan's max count", () => {
    test.each([
      [ProductTierType.Free, 2],
      [ProductTierType.Families, 6],
      [ProductTierType.TeamsStarter, 10],
    ])(`should return null on plan %s`, (plan, planSeatCount) => {
      const organization = orgFactory({
        productTierType: plan,
        seats: planSeatCount,
      });

      const occupiedSeatCount = 0;

      const validatorFn = orgSeatLimitReachedValidator(
        organization,
        allOrganizationUserEmails,
        "Generic error message",
        occupiedSeatCount,
      );

      const control = new FormControl(createUniqueEmailString(1));

      const result = validatorFn(control);

      expect(result).toBeNull();
    });
  });

  describe("when total occupied seat count is at plan's max count", () => {
    test.each([
      [ProductTierType.Free, 2, 1],
      [ProductTierType.Families, 6, 5],
      [ProductTierType.TeamsStarter, 10, 9],
    ])(`should return null on plan %s`, (plan, planSeatCount, newEmailCount) => {
      const organization = orgFactory({
        productTierType: plan,
        seats: planSeatCount,
      });

      const occupiedSeatCount = 1;

      const validatorFn = orgSeatLimitReachedValidator(
        organization,
        allOrganizationUserEmails,
        "Generic error message",
        occupiedSeatCount,
      );

      const control = new FormControl(createUniqueEmailString(newEmailCount));

      const result = validatorFn(control);

      expect(result).toBeNull();
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
