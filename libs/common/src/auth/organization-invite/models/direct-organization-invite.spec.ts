import { Jsonify } from "type-fest";

import { DirectOrganizationInvite } from "./direct-organization-invite";

describe("DirectOrganizationInvite", () => {
  const validId = "00000000-0000-0000-0000-000000000001";
  const validUserId = "00000000-0000-0000-0000-000000000002";

  describe("constructor", () => {
    it("assigns all required fields", () => {
      const invite = new DirectOrganizationInvite({
        email: "user@example.com",
        initOrganization: true,
        orgUserHasExistingUser: false,
        organizationId: "organizationId",
        organizationName: "organizationName",
        organizationUserId: "organizationUserId",
        token: "token",
      });

      expect(invite.email).toBe("user@example.com");
      expect(invite.initOrganization).toBe(true);
      expect(invite.orgUserHasExistingUser).toBe(false);
      expect(invite.organizationId).toBe("organizationId");
      expect(invite.organizationName).toBe("organizationName");
      expect(invite.organizationUserId).toBe("organizationUserId");
      expect(invite.token).toBe("token");
    });

    it("leaves orgSsoIdentifier undefined when not provided", () => {
      const invite = new DirectOrganizationInvite({
        email: "user@example.com",
        initOrganization: false,
        orgUserHasExistingUser: false,
        organizationId: "organizationId",
        organizationName: "organizationName",
        organizationUserId: "organizationUserId",
        token: "token",
      });

      expect(invite.orgSsoIdentifier).toBeUndefined();
    });

    it("assigns orgSsoIdentifier when provided", () => {
      const invite = new DirectOrganizationInvite({
        email: "user@example.com",
        initOrganization: false,
        orgUserHasExistingUser: false,
        organizationId: "organizationId",
        organizationName: "organizationName",
        organizationUserId: "organizationUserId",
        token: "token",
        orgSsoIdentifier: "sso-identifier",
      });

      expect(invite.orgSsoIdentifier).toBe("sso-identifier");
    });
  });

  describe("fromUrlParams", () => {
    const validParams = (): Record<string, string | undefined> => ({
      organizationId: validId,
      organizationUserId: validUserId,
      email: "user@example.com",
      organizationName: "Acme Inc.",
      token: "invite-token",
      initOrganization: "false",
      orgUserHasExistingUser: "true",
    });

    it("returns null when params is null", () => {
      expect(DirectOrganizationInvite.fromUrlParams(null as any)).toBeNull();
    });

    it("returns a fully populated DirectOrganizationInvite when all required params are present", () => {
      const result = DirectOrganizationInvite.fromUrlParams(validParams());

      expect(result).toBeInstanceOf(DirectOrganizationInvite);
      expect(result).toMatchObject({
        organizationId: validId,
        organizationUserId: validUserId,
        email: "user@example.com",
        organizationName: "Acme Inc.",
        token: "invite-token",
        initOrganization: false,
        orgUserHasExistingUser: true,
      });
      expect(result!.orgSsoIdentifier).toBeUndefined();
    });

    it.each([
      "organizationId",
      "organizationUserId",
      "email",
      "organizationName",
      "token",
      "initOrganization",
      "orgUserHasExistingUser",
    ])("returns null when required param '%s' is missing", (key) => {
      const params = validParams();
      delete params[key];

      expect(DirectOrganizationInvite.fromUrlParams(params)).toBeNull();
    });

    it.each(["organizationId", "organizationUserId"])(
      "returns null when '%s' is not a valid GUID",
      (key) => {
        const params = validParams();
        params[key] = "not-a-guid";

        expect(DirectOrganizationInvite.fromUrlParams(params)).toBeNull();
      },
    );

    it.each([
      ["true", true],
      ["TRUE", true],
      ["True", true],
      ["false", false],
      ["FALSE", false],
      ["anything-else", false],
    ])(
      "coerces stringified initOrganization '%s' to boolean %s",
      (input: string, expected: boolean) => {
        const params = validParams();
        params.initOrganization = input;

        const result = DirectOrganizationInvite.fromUrlParams(params);

        expect(result?.initOrganization).toBe(expected);
      },
    );

    it.each([
      ["true", true],
      ["TRUE", true],
      ["false", false],
      ["anything-else", false],
    ])(
      "coerces stringified orgUserHasExistingUser '%s' to boolean %s",
      (input: string, expected: boolean) => {
        const params = validParams();
        params.orgUserHasExistingUser = input;

        const result = DirectOrganizationInvite.fromUrlParams(params);

        expect(result?.orgUserHasExistingUser).toBe(expected);
      },
    );

    it("carries orgSsoIdentifier through when present", () => {
      const params = validParams();
      params.orgSsoIdentifier = "sso-identifier";

      const result = DirectOrganizationInvite.fromUrlParams(params);

      expect(result?.orgSsoIdentifier).toBe("sso-identifier");
    });
  });

  describe("fromJSON", () => {
    it("returns null when json is null", () => {
      expect(DirectOrganizationInvite.fromJSON(null as any)).toBeNull();
    });

    it("builds a DirectOrganizationInvite from a valid JSON object", () => {
      const json = {
        kind: "direct",
        email: "user@example.com",
        initOrganization: true,
        orgSsoIdentifier: "sso-identifier",
        orgUserHasExistingUser: false,
        organizationId: "organizationId",
        organizationName: "organizationName",
        organizationUserId: "organizationUserId",
        token: "token",
      } satisfies Jsonify<DirectOrganizationInvite>;

      const result = DirectOrganizationInvite.fromJSON(json);

      expect(result).toBeInstanceOf(DirectOrganizationInvite);
      expect(result).toMatchObject(json);
    });
  });
});
