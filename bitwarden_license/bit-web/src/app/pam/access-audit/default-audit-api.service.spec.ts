import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { DefaultAuditApiService } from "./default-audit-api.service";

const ORGANIZATION_ID = "org-1";
const USER_ID = "user-1";

/**
 * The wire shape of the trail read. Worth its own tests because the filters only reach the server if the
 * query string is spelled the way the endpoint's binding reads it — and a dimension spelled wrong comes
 * back as an unfiltered trail rather than as an error.
 */
describe("DefaultAuditApiService", () => {
  let apiService: { send: jest.Mock };
  let service: DefaultAuditApiService;

  beforeEach(() => {
    apiService = { send: jest.fn().mockResolvedValue({ Data: [], ContinuationToken: null }) };
    service = new DefaultAuditApiService(
      apiService as unknown as ApiService,
      { activeAccount$: of({ id: USER_ID }) } as unknown as AccountService,
    );
  });

  /** The path the read was sent to, which is where the filter lives. */
  const requestedPath = () => apiService.send.mock.calls[0][1] as string;

  const query = () => new URLSearchParams(requestedPath().split("?")[1] ?? "");

  it("reads the organization's trail, authenticated for the active account", async () => {
    await service.listAccessAuditTrail(ORGANIZATION_ID);

    expect(apiService.send).toHaveBeenCalledWith(
      "GET",
      `/organizations/${ORGANIZATION_ID}/audit`,
      null,
      USER_ID,
      true,
    );
  });

  // An unset dimension is omitted rather than sent empty: an empty list on the wire would mean "match
  // nothing" where the caller meant "no filter".
  it("sends no query string at all for an empty filter", async () => {
    await service.listAccessAuditTrail(ORGANIZATION_ID, {});

    expect(requestedPath()).toBe(`/organizations/${ORGANIZATION_ID}/audit`);
  });

  it("omits a dimension whose selection is empty", async () => {
    await service.listAccessAuditTrail(ORGANIZATION_ID, {
      kinds: [],
      actorIds: [],
      requesterIds: [],
      includeAutomatedActor: false,
    });

    expect(requestedPath()).toBe(`/organizations/${ORGANIZATION_ID}/audit`);
  });

  // Repeated keys rather than one comma-joined value, which is what the server's array binding reads.
  it("spells a multi-select dimension as a repeated key", async () => {
    await service.listAccessAuditTrail(ORGANIZATION_ID, {
      kinds: ["requestApproved", "leaseRevoked"],
      actorIds: ["actor-a", "actor-b"],
      requesterIds: ["requester-a"],
    });

    expect(query().getAll("kind")).toEqual(["requestApproved", "leaseRevoked"]);
    expect(query().getAll("actorId")).toEqual(["actor-a", "actor-b"]);
    expect(query().getAll("requesterId")).toEqual(["requester-a"]);
  });

  // ISO instants, so the server reads the moment the auditor picked whatever timezone either end sits in.
  it("sends the bounds as ISO instants", async () => {
    const start = new Date("2026-08-18T09:00:00.000Z");
    const end = new Date("2026-08-18T17:00:00.000Z");

    await service.listAccessAuditTrail(ORGANIZATION_ID, { start, end });

    expect(query().get("start")).toBe("2026-08-18T09:00:00.000Z");
    expect(query().get("end")).toBe("2026-08-18T17:00:00.000Z");
  });

  it("sends the automatic-actor bucket as a flag rather than an id", async () => {
    await service.listAccessAuditTrail(ORGANIZATION_ID, {
      actorIds: ["actor-a"],
      includeAutomatedActor: true,
    });

    expect(query().get("includeAutomatedActor")).toBe("true");
    expect(query().getAll("actorId")).toEqual(["actor-a"]);
  });

  // The Item chip carries both kinds, so the two travel as separate repeated keys and the server unions
  // them. One list would have to be matched against two columns, which cannot be spelled on the wire.
  it("sends the two halves of an Item selection as separate repeated keys", async () => {
    await service.listAccessAuditTrail(ORGANIZATION_ID, {
      cipherIds: ["cipher-1", "cipher-2"],
      ruleIds: ["rule-1"],
    });

    expect(query().getAll("cipherId")).toEqual(["cipher-1", "cipher-2"]);
    expect(query().getAll("ruleId")).toEqual(["rule-1"]);
  });

  it("sends the resume position when it is set", async () => {
    await service.listAccessAuditTrail(ORGANIZATION_ID, {
      continuationToken: "638000000000000000_0123456789abcdef0123456789abcdef",
    });

    expect(query().get("continuationToken")).toBe(
      "638000000000000000_0123456789abcdef0123456789abcdef",
    );
  });

  describe("listAccessAuditItems", () => {
    it("reads the item menu for the organization, unbounded when no range is given", async () => {
      apiService.send.mockResolvedValue({ Data: [] });

      await service.listAccessAuditItems(ORGANIZATION_ID);

      expect(requestedPath()).toBe(`/organizations/${ORGANIZATION_ID}/audit/items`);
    });

    it("sends the range the menu follows", async () => {
      apiService.send.mockResolvedValue({ Data: [] });

      await service.listAccessAuditItems(ORGANIZATION_ID, {
        start: new Date("2026-08-18T09:00:00.000Z"),
      });

      expect(query().get("start")).toBe("2026-08-18T09:00:00.000Z");
    });

    it("reads back a credential and a rule, telling them apart by which pair is set", async () => {
      apiService.send.mockResolvedValue({
        Data: [
          { CipherId: "cipher-1", CollectionId: "collection-1" },
          { RuleId: "rule-1", RuleName: "Production database" },
        ],
      });

      const items = await service.listAccessAuditItems(ORGANIZATION_ID);

      expect(items[0].cipherId).toBe("cipher-1");
      expect(items[0].collectionId).toBe("collection-1");
      expect(items[0].ruleId).toBeNull();
      expect(items[1].ruleId).toBe("rule-1");
      expect(items[1].ruleName).toBe("Production database");
      expect(items[1].cipherId).toBeNull();
    });
  });

  it("reads the page and its resume position out of the response", async () => {
    apiService.send.mockResolvedValue({
      Data: [{ Kind: "requestApproved", OccurredAt: "2026-08-18T09:00:00.000Z" }],
      ContinuationToken: "page-2",
    });

    const page = await service.listAccessAuditTrail(ORGANIZATION_ID);

    expect(page.data).toHaveLength(1);
    expect(page.data[0].kind).toBe("requestApproved");
    expect(page.continuationToken).toBe("page-2");
  });

  // The last page carries no token, and null is what tells a caller walking the trail to stop.
  it("reports no resume position on the last page", async () => {
    apiService.send.mockResolvedValue({ Data: [] });

    expect((await service.listAccessAuditTrail(ORGANIZATION_ID)).continuationToken).toBeNull();
  });
});
