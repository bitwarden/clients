import { Jsonify } from "type-fest";

import { OrganizationInvite } from "./organization-invite";

describe("OrganizationInvite", () => {
  const validId = "00000000-0000-0000-0000-000000000001";
  const validUserId = "00000000-0000-0000-0000-000000000002";

  describe("constructor", () => {
    it("assigns all required fields", () => {
      const invite = new OrganizationInvite({
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
      const invite = new OrganizationInvite({
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
      const invite = new OrganizationInvite({
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
      expect(OrganizationInvite.fromUrlParams(null as any)).toBeNull();
    });

    it("returns a fully populated OrganizationInvite when all required params are present", () => {
      const result = OrganizationInvite.fromUrlParams(validParams());

      expect(result).toBeInstanceOf(OrganizationInvite);
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

      expect(OrganizationInvite.fromUrlParams(params)).toBeNull();
    });

    it.each(["organizationId", "organizationUserId"])(
      "returns null when '%s' is not a valid GUID",
      (key) => {
        const params = validParams();
        params[key] = "not-a-guid";

        expect(OrganizationInvite.fromUrlParams(params)).toBeNull();
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

        const result = OrganizationInvite.fromUrlParams(params);

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

        const result = OrganizationInvite.fromUrlParams(params);

        expect(result?.orgUserHasExistingUser).toBe(expected);
      },
    );

    it("carries orgSsoIdentifier through when present", () => {
      const params = validParams();
      params.orgSsoIdentifier = "sso-identifier";

      const result = OrganizationInvite.fromUrlParams(params);

      expect(result?.orgSsoIdentifier).toBe("sso-identifier");
    });
  });

  describe("fromJSON", () => {
    it("returns null when json is null", () => {
      expect(OrganizationInvite.fromJSON(null as any)).toBeNull();
    });

    it("builds an OrganizationInvite from a valid JSON object", () => {
      const json = {
        email: "user@example.com",
        initOrganization: true,
        orgSsoIdentifier: "sso-identifier",
        orgUserHasExistingUser: false,
        organizationId: "organizationId",
        organizationName: "organizationName",
        organizationUserId: "organizationUserId",
        token: "token",
      } satisfies Jsonify<OrganizationInvite>;

      const result = OrganizationInvite.fromJSON(json);

      expect(result).toBeInstanceOf(OrganizationInvite);
      expect(result).toMatchObject(json);
    });
  });

  describe("toAcceptOrgUrl", () => {
    const validParams = (): Record<string, string | undefined> => ({
      organizationId: validId,
      organizationUserId: validUserId,
      email: "user@example.com",
      organizationName: "Acme Inc.",
      token: "invite-token",
      initOrganization: "false",
      orgUserHasExistingUser: "true",
    });

    // Parses a URL emitted by `toAcceptOrgUrl` back into the same
    // Record<string, string> shape `fromUrlParams` accepts, so a
    // fromUrlParams -> toAcceptOrgUrl -> fromUrlParams round-trip
    // reads naturally in each test below.
    const parseAcceptOrgUrl = (url: string): Record<string, string> => {
      const [, queryString] = url.split("?");
      return Object.fromEntries(new URLSearchParams(queryString));
    };

    it("round-trips the required fields via fromUrlParams", () => {
      const invite = OrganizationInvite.fromUrlParams(validParams());

      const rebuilt = OrganizationInvite.fromUrlParams(parseAcceptOrgUrl(invite!.toAcceptOrgUrl()));

      expect(rebuilt).toEqual(invite);
    });

    it("round-trips orgSsoIdentifier when present", () => {
      const params = validParams();
      params.orgSsoIdentifier = "sso-identifier";
      const invite = OrganizationInvite.fromUrlParams(params);

      const rebuilt = OrganizationInvite.fromUrlParams(parseAcceptOrgUrl(invite!.toAcceptOrgUrl()));

      expect(rebuilt).toEqual(invite);
      expect(rebuilt!.orgSsoIdentifier).toBe("sso-identifier");
    });

    it("omits orgSsoIdentifier from the URL when the invite doesn't have one", () => {
      const invite = OrganizationInvite.fromUrlParams(validParams());

      expect(invite!.toAcceptOrgUrl()).not.toContain("orgSsoIdentifier");
    });

    it("uses /accept-organization as the path with organizationId in the query", () => {
      const invite = OrganizationInvite.fromUrlParams(validParams());

      const url = invite!.toAcceptOrgUrl();
      expect(url.startsWith("/accept-organization?")).toBe(true);
      expect(parseAcceptOrgUrl(url).organizationId).toBe(validId);
    });

    it("preserves values that require URL encoding through a round-trip", () => {
      const params = validParams();
      params.email = "user+plus@example.com";
      params.organizationName = "Acme & Co.";
      const invite = OrganizationInvite.fromUrlParams(params);

      const rebuilt = OrganizationInvite.fromUrlParams(parseAcceptOrgUrl(invite!.toAcceptOrgUrl()));

      expect(rebuilt!.email).toBe("user+plus@example.com");
      expect(rebuilt!.organizationName).toBe("Acme & Co.");
    });
  });
});
