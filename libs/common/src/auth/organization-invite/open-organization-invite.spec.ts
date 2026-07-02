import { Jsonify } from "type-fest";

import { OpenOrgInviteSsoConfig, OpenOrgInviteStatus } from "./open-org-invite-status";
import { OpenOrganizationInvite, OpenOrgInviteUrlParams } from "./open-organization-invite";

describe("OpenOrganizationInvite", () => {
  const ssoConfig: OpenOrgInviteSsoConfig = {
    orgSsoId: "sso-identifier",
    required: true,
  };

  describe("constructor", () => {
    it("assigns all required fields", () => {
      const invite = new OpenOrganizationInvite({
        inviteLinkCode: "inviteLinkCode",
        inviteKey: "inviteKey",
        organizationId: "organizationId",
        organizationName: "organizationName",
      });

      expect(invite.inviteLinkCode).toBe("inviteLinkCode");
      expect(invite.inviteKey).toBe("inviteKey");
      expect(invite.organizationId).toBe("organizationId");
      expect(invite.organizationName).toBe("organizationName");
    });

    it("leaves sso undefined when not provided", () => {
      const invite = new OpenOrganizationInvite({
        inviteLinkCode: "inviteLinkCode",
        inviteKey: "inviteKey",
        organizationId: "organizationId",
        organizationName: "organizationName",
      });

      expect(invite.sso).toBeUndefined();
    });

    it("assigns sso when provided", () => {
      const invite = new OpenOrganizationInvite({
        inviteLinkCode: "inviteLinkCode",
        inviteKey: "inviteKey",
        organizationId: "organizationId",
        organizationName: "organizationName",
        sso: ssoConfig,
      });

      expect(invite.sso).toEqual(ssoConfig);
    });
  });

  describe("fromUrlParamsAndStatus", () => {
    const validUrlParams = (): OpenOrgInviteUrlParams => ({
      inviteLinkCode: "invite-link-code",
      inviteKey: "invite-key",
    });

    const validStatus = (overrides: Partial<OpenOrgInviteStatus> = {}): OpenOrgInviteStatus => ({
      organizationId: "organizationId",
      organizationName: "Acme Inc.",
      seatsAvailable: true,
      sso: null,
      ...overrides,
    });

    it("returns a fully populated OpenOrganizationInvite", () => {
      const result = OpenOrganizationInvite.fromUrlParamsAndStatus(
        validUrlParams(),
        validStatus({ sso: ssoConfig }),
      );

      expect(result).toBeInstanceOf(OpenOrganizationInvite);
      expect(result).toMatchObject({
        kind: "open",
        inviteLinkCode: "invite-link-code",
        inviteKey: "invite-key",
        organizationId: "organizationId",
        organizationName: "Acme Inc.",
        sso: ssoConfig,
      });
    });

    it("normalizes a null sso from the status to undefined", () => {
      const result = OpenOrganizationInvite.fromUrlParamsAndStatus(
        validUrlParams(),
        validStatus({ sso: null }),
      );

      expect(result.sso).toBeUndefined();
    });

    it("carries sso through when the status includes it", () => {
      const result = OpenOrganizationInvite.fromUrlParamsAndStatus(
        validUrlParams(),
        validStatus({ sso: ssoConfig }),
      );

      expect(result.sso).toEqual(ssoConfig);
    });
  });

  describe("fromJSON", () => {
    it("returns null when json is null", () => {
      expect(OpenOrganizationInvite.fromJSON(null as any)).toBeNull();
    });

    it("builds an OpenOrganizationInvite from a valid JSON object", () => {
      const json = {
        kind: "open",
        inviteLinkCode: "invite-link-code",
        inviteKey: "invite-key",
        organizationId: "organizationId",
        organizationName: "organizationName",
        sso: ssoConfig,
      } satisfies Jsonify<OpenOrganizationInvite>;

      const result = OpenOrganizationInvite.fromJSON(json);

      expect(result).toBeInstanceOf(OpenOrganizationInvite);
      expect(result).toMatchObject(json);
    });
  });
});
