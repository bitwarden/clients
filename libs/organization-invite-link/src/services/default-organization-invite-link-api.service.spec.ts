import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

import { OrganizationInviteLinkConfirmRequest } from "../models/requests/organization-invite-link-confirm.request";

import { DefaultOrganizationInviteLinkApiService } from "./default-organization-invite-link-api.service";

function validationProblem(type: string, detail: string, property = "code"): ErrorResponse {
  return new ErrorResponse({ errors: { [property]: [{ type, detail }] } }, 400);
}

describe("DefaultOrganizationInviteLinkApiService", () => {
  let apiService: MockProxy<ApiService>;
  let sut: DefaultOrganizationInviteLinkApiService;
  const request = {} as OrganizationInviteLinkConfirmRequest;

  beforeEach(() => {
    apiService = mock<ApiService>();
    sut = new DefaultOrganizationInviteLinkApiService(apiService);
  });

  describe("confirm", () => {
    it("returns ok when the request succeeds", async () => {
      apiService.send.mockResolvedValue(undefined);

      const result = await sut.confirm(request);

      expect(result).toEqual({ kind: "ok" });
      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/organizations/users/invite-link/confirm",
        request,
        true,
        false,
      );
    });

    it.each([
      ["invite_link_not_available", "invite-link-not-available"],
      ["email_domain_not_allowed", "email-domain-not-allowed"],
      ["provider_users_cannot_join", "provider-users-cannot-join"],
      ["organization_access_revoked", "organization-access-revoked"],
      ["already_organization_member", "already-organization-member"],
      ["organization_has_no_available_seats", "organization-has-no-available-seats"],
      ["seat_add_failed", "seat-add-failed"],
      ["reset_password_key_required", "reset-password-key-required"],
      ["member_of_another_organization", "member-of-another-organization"],
      ["single_organization_policy", "single-organization-policy"],
      ["two_factor_required_for_membership", "two-factor-required-for-membership"],
      ["only_one_free_organization_admin_allowed", "only-one-free-organization-admin-allowed"],
    ])("maps the %s validation error to the %s kind", async (type, kind) => {
      apiService.send.mockRejectedValue(validationProblem(type, "boom"));

      const result = await sut.confirm(request);

      expect(result).toEqual({ kind, cause: "boom" });
    });

    it("maps an unknown 400 validation error type to unexpected-error", async () => {
      apiService.send.mockRejectedValue(validationProblem("some_new_server_error", "boom"));

      const result = await sut.confirm(request);

      expect(result).toEqual({ kind: "unexpected-error", cause: "boom" });
    });

    it("maps a 404 to invite-link-not-found", async () => {
      apiService.send.mockRejectedValue(
        new ErrorResponse({ Message: "Invite link not found." }, 404),
      );

      const result = await sut.confirm(request);

      expect(result).toEqual({ kind: "invite-link-not-found", cause: "Invite link not found." });
    });

    it.each([401, 403])("maps a %s to unauthorized", async (status) => {
      apiService.send.mockRejectedValue(new ErrorResponse({ Message: "Access denied." }, status));

      const result = await sut.confirm(request);

      expect(result).toEqual({ kind: "unauthorized", cause: "Access denied." });
    });

    it("maps other status codes to unexpected-error", async () => {
      apiService.send.mockRejectedValue(new ErrorResponse({ Message: "Server error." }, 500));

      const result = await sut.confirm(request);

      expect(result).toEqual({ kind: "unexpected-error", cause: "Server error." });
    });

    it("maps a non-ErrorResponse throwable to unexpected-error", async () => {
      apiService.send.mockRejectedValue(new Error("network down"));

      const result = await sut.confirm(request);

      expect(result).toEqual({ kind: "unexpected-error", cause: "Error: network down" });
    });
  });
});
