import {
  OrganizationUserResetPasswordEnrollmentRequest,
  OrganizationUserResetPasswordWithIdRequest,
} from "./organization-user-reset-password-enrollment.request";

describe("OrganizationUserResetPasswordWithIdRequest", () => {
  it("should set organizationId from the constructor parameter", () => {
    const request = new OrganizationUserResetPasswordWithIdRequest("org-123");

    expect(request.organizationId).toBe("org-123");
  });

  it("should call super() so inherited request fields are settable", () => {
    const request = new OrganizationUserResetPasswordWithIdRequest("org-123");

    request.resetPasswordKey = "encrypted-reset-key";
    request.masterPasswordHash = "hash";

    expect(request).toBeInstanceOf(OrganizationUserResetPasswordEnrollmentRequest);
    expect(request.resetPasswordKey).toBe("encrypted-reset-key");
    expect(request.masterPasswordHash).toBe("hash");
  });
});
