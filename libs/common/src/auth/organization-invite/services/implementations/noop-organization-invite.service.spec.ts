import { firstValueFrom } from "rxjs";

import { UserId } from "@bitwarden/user-core";

import { DirectOrganizationInvite } from "../../models/direct-organization-invite";
import { OpenOrganizationInvite } from "../../models/open-organization-invite";

import { NoopOrganizationInviteService } from "./noop-organization-invite.service";

describe("NoopOrganizationInviteService", () => {
  let service: NoopOrganizationInviteService;
  let directInvite: DirectOrganizationInvite;
  let openInvite: OpenOrganizationInvite;

  beforeEach(() => {
    service = new NoopOrganizationInviteService();
    directInvite = new DirectOrganizationInvite({
      email: "user@example.com",
      initOrganization: false,
      orgUserHasExistingUser: false,
      organizationId: "org-id",
      organizationName: "Acme",
      organizationUserId: "org-user-id",
      token: "token",
    });
    openInvite = new OpenOrganizationInvite({
      organizationId: "org-id",
      inviteLinkCode: "link-code",
      inviteKey: "link-key",
      organizationName: "Acme",
    });
  });

  describe("reads — return the 'no invite in state' answer", () => {
    it("activeInvite$ emits null", async () => {
      await expect(firstValueFrom(service.activeInvite$)).resolves.toBeNull();
    });

    it("getOrganizationInvite resolves to null", async () => {
      await expect(service.getOrganizationInvite()).resolves.toBeNull();
    });

    it("getOpenOrgInvite resolves to null", async () => {
      await expect(service.getOpenOrgInvite()).resolves.toBeNull();
    });

    it("getOrgPoliciesForInvite resolves to undefined", async () => {
      await expect(service.getOrgPoliciesForInvite(directInvite)).resolves.toBeUndefined();
    });

    it("getMasterPasswordPolicyOptionsForInvite resolves to undefined", async () => {
      await expect(
        service.getMasterPasswordPolicyOptionsForInvite(directInvite),
      ).resolves.toBeUndefined();
    });
  });

  describe("idempotent cleanups — silent resolve", () => {
    it("clearOrganizationInvite resolves without error", async () => {
      await expect(service.clearOrganizationInvite()).resolves.toBeUndefined();
    });

    it("clearOpenOrgInvite resolves without error", async () => {
      await expect(service.clearOpenOrgInvite()).resolves.toBeUndefined();
    });

    it("clearSealedOpenOrgInviteSecret resolves without error", async () => {
      await expect(
        service.clearSealedOpenOrgInviteSecret("user@example.com"),
      ).resolves.toBeUndefined();
    });

    it("clearExpiredSealedOpenOrgInviteSecrets resolves without error", async () => {
      await expect(service.clearExpiredSealedOpenOrgInviteSecrets()).resolves.toBeUndefined();
    });
  });

  describe("persistence writes and result-typed methods — throw DI-misconfig errors", () => {
    // Every message must both name the method and reference DefaultOrganizationInviteService so
    // an unhandled-exception log unambiguously fingers the DI wire-up as the cause, not the
    // caller's invite flow.
    const expectDiMisconfigError = async (
      methodName: string,
      call: () => Promise<unknown>,
    ): Promise<void> => {
      await expect(call()).rejects.toThrow(
        new RegExp(
          `${methodName}.*NoopOrganizationInviteService.*DefaultOrganizationInviteService`,
        ),
      );
    };

    it("setOrganizationInvite throws", async () => {
      await expectDiMisconfigError("setOrganizationInvite", () =>
        service.setOrganizationInvite(directInvite),
      );
    });

    it("validateAndAcceptDirectOrgInvite throws", async () => {
      await expectDiMisconfigError("validateAndAcceptDirectOrgInvite", () =>
        service.validateAndAcceptDirectOrgInvite(directInvite, "user-id" as UserId, "/redirect"),
      );
    });

    it("acceptOpenOrgInvite throws", async () => {
      await expectDiMisconfigError("acceptOpenOrgInvite", () =>
        service.acceptOpenOrgInvite(openInvite, "user-id" as UserId, "/redirect"),
      );
    });

    it("getOpenOrgInviteStatus throws", async () => {
      await expectDiMisconfigError("getOpenOrgInviteStatus", () =>
        service.getOpenOrgInviteStatus("org-id", "code"),
      );
    });

    it("validateOpenOrgInviteEmailDomain throws", async () => {
      await expectDiMisconfigError("validateOpenOrgInviteEmailDomain", () =>
        service.validateOpenOrgInviteEmailDomain("org-id", "code", "user@example.com"),
      );
    });

    it("sealOpenOrgInvite throws", async () => {
      await expectDiMisconfigError("sealOpenOrgInvite", () =>
        service.sealOpenOrgInvite("user@example.com", {
          organizationId: "org-id",
          inviteLinkCode: "link-code",
          inviteKey: "link-key",
        }),
      );
    });

    it("unsealOpenOrgInvite throws", async () => {
      await expectDiMisconfigError("unsealOpenOrgInvite", () =>
        service.unsealOpenOrgInvite("user@example.com", "sealed"),
      );
    });
  });
});
