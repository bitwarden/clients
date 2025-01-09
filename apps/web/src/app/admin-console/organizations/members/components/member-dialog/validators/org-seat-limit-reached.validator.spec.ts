import { AbstractControl, FormControl, ValidationErrors } from "@angular/forms";

import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";

import { orgSeatLimitReachedValidator } from "./org-seat-limit-reached.validator";

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
