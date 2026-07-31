import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventResponse, EventType } from "@bitwarden/common/dirt/event-logs";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { EventOptions, EventService } from "./event.service";

describe("EventService Send events", () => {
  let sut: EventService;

  // Echoes the key and appends each substitution arg, so assertions can detect whether an interactive
  // anchor (with its sentinel href) made it into the message vs. the plain human-readable copy.
  const i18n = mock<I18nService>();
  i18n.t.mockImplementation(
    (id: string, p1?: string, p2?: string) => `${id}${p1 ?? ""}${p2 ?? ""}`,
  );

  beforeEach(() => {
    const policyService = mock<PolicyService>();
    policyService.policies$.mockReturnValue(of([]));
    const accountService = mock<AccountService>();
    (accountService as any).activeAccount$ = of({ id: "user-id" });

    sut = new EventService(i18n, policyService, accountService);
  });

  const sendId = "send-1234-5678";
  const creatorId = "creator-9012-3456";

  function accessEvent(type: EventType): EventResponse {
    return { type, sendId, userId: creatorId, organizationId: "org" } as EventResponse;
  }

  it("renders a Send access message with clickable Send-id and creator links (sentinel hrefs)", async () => {
    const info = await sut.getEventInfo(accessEvent(EventType.Send_Accessed_Text));

    expect(info.message).toContain(`href="#send-events:${sendId}"`);
    expect(info.message).toContain(`href="#member-events:${creatorId}"`);
  });

  it("keeps the human-readable (export) message plain text", async () => {
    const info = await sut.getEventInfo(accessEvent(EventType.Send_Accessed_File));

    expect(info.humanReadableMessage).not.toContain("href");
    expect(info.humanReadableMessage).not.toContain("<a");
    expect(info.humanReadableMessage).toContain(sendId.substring(0, 8));
  });

  it("omits the Send id when hideSendId is set (Send-scoped dialog) but keeps the creator", async () => {
    const options = new EventOptions();
    options.hideSendId = true;

    const info = await sut.getEventInfo(accessEvent(EventType.Send_Accessed_Text), options);

    expect(info.message).not.toContain("#send-events:");
    expect(info.message).toContain(`href="#member-events:${creatorId}"`);
  });

  it("renders the creator id as plain text (no link) when the creator is not a linkable member", async () => {
    const options = new EventOptions();
    options.linkableMemberIds = new Set<string>(); // creator absent => not linkable

    const info = await sut.getEventInfo(accessEvent(EventType.Send_Accessed_Text), options);

    expect(info.message).toContain(`href="#send-events:${sendId}"`);
    expect(info.message).not.toContain("#member-events:");
    expect(info.message).toContain(creatorId.substring(0, 8));
  });

  it("keeps the creator id linked when the creator is a linkable member", async () => {
    const options = new EventOptions();
    options.linkableMemberIds = new Set<string>([creatorId]);

    const info = await sut.getEventInfo(accessEvent(EventType.Send_Accessed_File), options);

    expect(info.message).toContain(`href="#member-events:${creatorId}"`);
  });

  it("renders the Send id on a create event", async () => {
    const info = await sut.getEventInfo({
      type: EventType.Send_Created_Text,
      sendId,
      organizationId: "org",
    } as EventResponse);

    expect(info.message).toContain(`href="#send-events:${sendId}"`);
    expect(info.humanReadableMessage).not.toContain("href");
    expect(info.humanReadableMessage).toContain(sendId.substring(0, 8));
  });
});

describe("EventService shortcode escaping", () => {
  let sut: EventService;

  const i18n = mock<I18nService>();
  i18n.t.mockImplementation(
    (id: string, p1?: string, p2?: string) => `${id}${p1 ?? ""}${p2 ?? ""}`,
  );

  beforeEach(() => {
    const policyService = mock<PolicyService>();
    policyService.policies$.mockReturnValue(of([]));
    const accountService = mock<AccountService>();
    (accountService as any).activeAccount$ = of({ id: "user-id" });

    sut = new EventService(i18n, policyService, accountService);
  });

  // getShortId only keeps the first 8 characters, so the payloads below are crafted so those first
  // 8 characters are HTML-significant. "<script>" is exactly 8 characters.
  const scriptId = "<script>alert(1)";
  const ampId = "a&b<c>def-tail"; // first 8 chars: a&b<c>de

  it("escapes the id in the plain (unlinked) cipher shortcode", async () => {
    // organizationId == null forces the non-anchor `<code>` branch of formatCipherId
    const info = await sut.getEventInfo({
      type: EventType.Cipher_Created,
      cipherId: scriptId,
      organizationId: null,
    } as EventResponse);

    expect(info.message).toContain("<code>&lt;script&gt;</code>");
    expect(info.message).not.toContain("<script>");
  });

  it("escapes ampersands and angle brackets in the plain cipher shortcode", async () => {
    const info = await sut.getEventInfo({
      type: EventType.Cipher_Created,
      cipherId: ampId,
      organizationId: null,
    } as EventResponse);

    expect(info.message).toContain("<code>a&amp;b&lt;c&gt;de</code>");
  });

  it("escapes the id inside the linked (anchor) cipher shortcode", async () => {
    // organizationId set + default cipherInfo=true routes through makeAnchor
    const info = await sut.getEventInfo({
      type: EventType.Cipher_Created,
      cipherId: scriptId,
      organizationId: "org",
    } as EventResponse);

    // The rendered id lives in the <code> child and must be escaped, even though the raw id still
    // appears inside the (attribute-quoted) href.
    expect(info.message).toContain("<code>&lt;script&gt;</code>");
  });

  it("escapes the creator id in the plain (non-linkable member) send shortcode", async () => {
    const options = new EventOptions();
    options.linkableMemberIds = new Set<string>(); // creator absent => not linkable => plain text

    const info = await sut.getEventInfo(
      {
        type: EventType.Send_Accessed_Text,
        sendId: "send-1234-5678",
        userId: scriptId,
        organizationId: "org",
      } as EventResponse,
      options,
    );

    expect(info.message).toContain("<code>&lt;script&gt;</code>");
    expect(info.message).not.toContain("<code><script></code>");
  });
});
