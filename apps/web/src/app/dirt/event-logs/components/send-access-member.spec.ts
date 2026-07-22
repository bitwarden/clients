import { mock } from "jest-mock-extended";

import { EventResponse, EventType } from "@bitwarden/common/dirt/event-logs";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import {
  collectLinkableMemberIds,
  isLinkableMember,
  resolveSendAccessMember,
  ResolvedMember,
} from "./send-access-member";

describe("resolveSendAccessMember", () => {
  const i18n = mock<I18nService>();
  i18n.t.mockImplementation((id: string, p1?: string) => `${id}${p1 ?? ""}`);

  const map = new Map<string, ResolvedMember>([
    ["member-user-id", { name: "Jack Smith", email: "jack@org.com", organizationUserId: "ou-1" }],
    ["creator-user-id", { name: "Pat Owner", email: "pat@org.com", organizationUserId: "ou-2" }],
  ]);

  const event = (over: Partial<EventResponse>): EventResponse =>
    ({ type: EventType.Send_Accessed_Text, ...over }) as EventResponse;

  it("returns undefined for non-Send-access events so callers fall through", () => {
    expect(
      resolveSendAccessMember(event({ type: EventType.Cipher_Created }), map, i18n),
    ).toBeUndefined();
  });

  it("returns the member when the accessor (actingUserId) is a confirmed member", () => {
    const result = resolveSendAccessMember(event({ actingUserId: "member-user-id" }), map, i18n);
    expect(result?.name).toBe("Jack Smith");
  });

  it("does not resolve from the creator (userId) for an external access", () => {
    // External accessor: actingUserId is null; userId falls back to the creator (a member).
    const result = resolveSendAccessMember(
      event({ actingUserId: null, userId: "creator-user-id", domainName: "acme.com" }),
      map,
      i18n,
    );
    expect(result?.name).toBe("sendAccessExternalDomainacme.com");
  });

  it("returns the generic External label when neither member nor domain is present", () => {
    const result = resolveSendAccessMember(
      event({ type: EventType.Send_Accessed_File, actingUserId: null, domainName: null }),
      map,
      i18n,
    );
    expect(result?.name).toBe("sendAccessExternal");
  });
});

describe("isLinkableMember", () => {
  const map = new Map<string, ResolvedMember>([
    ["member-user-id", { name: "Jack Smith", organizationUserId: "ou-1" }],
    ["provider-user-id", { name: "Casey Provider" }], // in the map, but not an org member (no organizationUserId)
  ]);

  it("is true for a user id with an organizationUserId", () => {
    expect(isLinkableMember("member-user-id", map)).toBe(true);
  });

  it("is false for a user id in the map without an organizationUserId", () => {
    expect(isLinkableMember("provider-user-id", map)).toBe(false);
  });

  it("is false for an unknown user id", () => {
    expect(isLinkableMember("unknown-id", map)).toBe(false);
  });

  it("is false for null/undefined", () => {
    expect(isLinkableMember(null, map)).toBe(false);
    expect(isLinkableMember(undefined, map)).toBe(false);
  });
});

describe("collectLinkableMemberIds", () => {
  it("returns only the ids with an organizationUserId", () => {
    const map = new Map<string, ResolvedMember>([
      ["member-user-id", { name: "Jack Smith", organizationUserId: "ou-1" }],
      ["provider-user-id", { name: "Casey Provider" }], // not an org member
    ]);

    const ids = collectLinkableMemberIds(map);

    expect(ids).toEqual(new Set(["member-user-id"]));
  });

  it("returns an empty set when no member data is loaded", () => {
    expect(collectLinkableMemberIds(new Map())).toEqual(new Set());
  });
});
