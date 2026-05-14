import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";

import { PendingSendDraftService } from "./pending-send-draft.service";

describe("PendingSendDraftService", () => {
  let service: PendingSendDraftService;
  let draft: SendView;

  beforeEach(() => {
    service = new PendingSendDraftService();
    draft = new SendView();
    draft.name = "test draft";
  });

  it("returns null before anything is stashed", () => {
    expect(service.consume("any-token")).toBeNull();
  });

  it("returns the stashed draft when the token matches", () => {
    service.set("token-1", draft);
    expect(service.consume("token-1")).toBe(draft);
  });

  it("clears the draft after a single consume so back-then-forward navigation does not re-leak it", () => {
    service.set("token-1", draft);
    expect(service.consume("token-1")).toBe(draft);
    expect(service.consume("token-1")).toBeNull();
  });

  it("returns null and clears the stash when the token does not match", () => {
    service.set("share-token", draft);
    expect(service.consume("different-token")).toBeNull();
    // Subsequent consume with the original token also gets nothing — stale draft cannot surface.
    expect(service.consume("share-token")).toBeNull();
  });

  it("set replaces the prior draft and its token", () => {
    service.set("token-1", draft);
    const replacement = new SendView();
    replacement.name = "replacement";
    service.set("token-2", replacement);
    expect(service.consume("token-1")).toBeNull();
    service.set("token-2", replacement);
    expect(service.consume("token-2")).toBe(replacement);
  });

  it("clear discards a stashed draft without surfacing it", () => {
    service.set("token-1", draft);
    service.clear();
    expect(service.consume("token-1")).toBeNull();
  });
});
