import { FormControl } from "@angular/forms";

import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { Guid } from "@bitwarden/common/types/guid";
import { newGuid } from "@bitwarden/guid";
import { UserId } from "@bitwarden/user-core";

import { OrganizationUserView } from "../../../../core/views/organization-user.view";

import { revokedEmailsValidator } from "./revoked-emails.validator";

const userFactory = (props: Partial<OrganizationUserView> = {}) =>
  Object.assign(
    new OrganizationUserView({
      id: newGuid() as Guid,
      userId: newGuid() as UserId,
      email: "",
      type: OrganizationUserType.User,
      revocationReason: null,
      status: OrganizationUserStatusType.Confirmed,
      permissions: null,
      avatarColor: null,
      name: null,
    }),
    props,
  );

const errorMessage =
  "1 or more emails belong to revoked members. Restore their access to reinvite.";

const revokedUser = userFactory({
  email: "revoked@example.com",
  status: OrganizationUserStatusType.Revoked,
});
const activeUser = userFactory({
  email: "active@example.com",
  status: OrganizationUserStatusType.Confirmed,
});

const validate = (users: OrganizationUserView[], value: string | null) =>
  revokedEmailsValidator(users, errorMessage)(new FormControl(value));

describe("revokedEmailsValidator", () => {
  it.each(["", null, "  "])("returns null for empty/blank input %p", (value) => {
    expect(validate([revokedUser], value)).toBeNull();
  });

  it("returns null when no revoked users exist", () => {
    expect(validate([activeUser], "active@example.com")).toBeNull();
  });

  it("returns null when revoked user email is not in the input", () => {
    expect(validate([revokedUser], "other@example.com")).toBeNull();
  });

  it("returns null when comma-separated input contains no revoked emails", () => {
    expect(validate([activeUser, revokedUser], "active@example.com, new@example.com")).toBeNull();
  });

  it("returns error when input matches a revoked user email", () => {
    expect(validate([revokedUser], "revoked@example.com")).toEqual({
      revokedEmails: { message: errorMessage },
    });
  });

  it("returns error for case-insensitive match", () => {
    const uppercaseRevoked = userFactory({
      email: "Revoked@Example.COM",
      status: OrganizationUserStatusType.Revoked,
    });
    expect(validate([uppercaseRevoked], "revoked@example.com")).toEqual({
      revokedEmails: { message: errorMessage },
    });
  });

  it("returns error when any email in a comma-separated list is revoked", () => {
    expect(validate([activeUser, revokedUser], "active@example.com, revoked@example.com")).toEqual({
      revokedEmails: { message: errorMessage },
    });
  });
});
