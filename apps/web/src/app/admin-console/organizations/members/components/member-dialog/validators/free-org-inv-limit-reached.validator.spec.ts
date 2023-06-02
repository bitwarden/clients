import { AbstractControl, FormControl, ValidationErrors } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductType } from "@bitwarden/common/enums";

import { freeOrgSeatLimitReachedValidator } from "./free-org-inv-limit-reached.validator";

const orgFactory = (props: Partial<Organization> = {}) =>
  Object.assign(
    new Organization(),
    {
      id: "myOrgId",
      enabled: true,
      type: OrganizationUserType.Admin,
    },
    props
  );

describe("freeOrgSeatLimitReachedValidator", () => {
  let organization: Organization;
  let allOrganizationUserEmails: string[];
  let i18nService: MockProxy<I18nService>;
  let validatorFn: (control: AbstractControl) => ValidationErrors | null;

  beforeEach(() => {
    i18nService = mock();
    allOrganizationUserEmails = ["user1@example.com"];
  });

  it("should return null when control value is empty", () => {
    validatorFn = freeOrgSeatLimitReachedValidator(
      organization,
      allOrganizationUserEmails,
      i18nService
    );
    const control = new FormControl("");

    const result = validatorFn(control);

    expect(result).toBeNull();
  });

  it("should return null when control value is null", () => {
    validatorFn = freeOrgSeatLimitReachedValidator(
      organization,
      allOrganizationUserEmails,
      i18nService
    );
    const control = new FormControl(null);

    const result = validatorFn(control);

    expect(result).toBeNull();
  });

  it("should return null when max seats are not exceeded on free plan", () => {
    organization = orgFactory({
      planProductType: ProductType.Free,
      seats: 2,
    });
    validatorFn = freeOrgSeatLimitReachedValidator(
      organization,
      allOrganizationUserEmails,
      i18nService
    );
    const control = new FormControl("user2@example.com");

    const result = validatorFn(control);

    expect(result).toBeNull();
  });

  it("should return validation error when max seats are exceeded on free plan", () => {
    organization = orgFactory({
      planProductType: ProductType.Free,
      seats: 2,
    });
    validatorFn = freeOrgSeatLimitReachedValidator(
      organization,
      allOrganizationUserEmails,
      i18nService
    );
    const control = new FormControl("user2@example.com,user3@example.com");

    const result = validatorFn(control);

    expect(result).not.toBeNull();
  });

  it("should return null when not on free plan", () => {
    const control = new FormControl("user2@example.com,user3@example.com");
    organization = orgFactory({
      planProductType: ProductType.Enterprise,
      seats: 100,
    });
    validatorFn = freeOrgSeatLimitReachedValidator(
      organization,
      allOrganizationUserEmails,
      i18nService
    );

    const result = validatorFn(control);

    expect(result).toBeNull();
  });
});
