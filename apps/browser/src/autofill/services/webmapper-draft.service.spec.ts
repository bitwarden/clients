import { firstValueFrom } from "rxjs";

import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { emptyDraft, WebmapperDraft } from "../webmapper/draft";

import { WebmapperDraftService } from "./webmapper-draft.service";

/** A draft with a single captured field, distinguishable from an empty draft. */
function draftWith(host: string, pathname: string | null): WebmapperDraft {
  const draft = emptyDraft(host, pathname);
  draft.forms[0].category = "login";
  draft.forms[0].fields.username = [{ selector: "input#user", warnings: [], alternates: [] }];
  return draft;
}

describe("WebmapperDraftService", () => {
  const mockUserId = "00000000-0000-0000-0000-000000000001" as UserId;
  let stateProvider: FakeStateProvider;
  let service: WebmapperDraftService;

  beforeEach(() => {
    stateProvider = new FakeStateProvider(mockAccountServiceWith(mockUserId));
    service = new WebmapperDraftService(stateProvider);
  });

  describe("draft$", () => {
    it("emits an empty draft when nothing is stored for the key", async () => {
      const draft = await firstValueFrom(service.draft$("example.com", "/login"));

      expect(draft).toEqual(emptyDraft("example.com", "/login"));
    });

    it("emits the stored draft once one is persisted", async () => {
      const stored = draftWith("example.com", "/login");

      await service.setDraft(stored);

      const draft = await firstValueFrom(service.draft$("example.com", "/login"));
      expect(draft).toEqual(stored);
    });

    it("propagates a background-driven capture to an existing subscriber", async () => {
      const emissions: WebmapperDraft[] = [];
      const sub = service.draft$("example.com", "/login").subscribe((d) => emissions.push(d));

      const stored = draftWith("example.com", "/login");
      await service.setDraft(stored);
      sub.unsubscribe();

      // First emission is the empty seed; the second reflects the persisted capture.
      expect(emissions[0]).toEqual(emptyDraft("example.com", "/login"));
      expect(emissions[emissions.length - 1]).toEqual(stored);
    });

    it("scopes drafts by pathname — a host+path key is distinct from the host-only key", async () => {
      const pathDraft = draftWith("example.com", "/login");

      await service.setDraft(pathDraft);

      // The host-only draft (pathname null) is untouched by the path-scoped write.
      const hostOnly = await firstValueFrom(service.draft$("example.com", null));
      expect(hostOnly).toEqual(emptyDraft("example.com", null));
    });

    it("scopes drafts by host", async () => {
      await service.setDraft(draftWith("example.com", "/login"));

      const otherHost = await firstValueFrom(service.draft$("other.com", "/login"));
      expect(otherHost).toEqual(emptyDraft("other.com", "/login"));
    });
  });

  describe("getDraft", () => {
    it("resolves the empty draft when nothing is stored", async () => {
      const draft = await service.getDraft("example.com", "/login");

      expect(draft).toEqual(emptyDraft("example.com", "/login"));
    });

    it("resolves the stored draft", async () => {
      const stored = draftWith("example.com", "/login");
      await service.setDraft(stored);

      const draft = await service.getDraft("example.com", "/login");
      expect(draft).toEqual(stored);
    });
  });

  describe("setDraft", () => {
    it("overwrites the draft for the same key", async () => {
      await service.setDraft(draftWith("example.com", "/login"));

      const updated = draftWith("example.com", "/login");
      updated.irrelevant = true;
      await service.setDraft(updated);

      const draft = await service.getDraft("example.com", "/login");
      expect(draft.irrelevant).toBe(true);
    });

    it("does not clobber drafts stored under other keys", async () => {
      const first = draftWith("example.com", "/login");
      const second = draftWith("other.com", "/signup");

      await service.setDraft(first);
      await service.setDraft(second);

      expect(await service.getDraft("example.com", "/login")).toEqual(first);
      expect(await service.getDraft("other.com", "/signup")).toEqual(second);
    });
  });

  describe("updateDraft", () => {
    it("applies the mutation to the stored draft", async () => {
      await service.setDraft(draftWith("example.com", "/login"));

      const next = await service.updateDraft("example.com", "/login", (d) => {
        d.irrelevant = true;
      });

      expect(next.irrelevant).toBe(true);
      expect((await service.getDraft("example.com", "/login")).irrelevant).toBe(true);
    });

    it("seeds an empty draft when nothing is stored yet", async () => {
      const next = await service.updateDraft("example.com", "/login", (d) => {
        d.forms[0].category = "identity";
      });

      expect(next.host).toBe("example.com");
      expect(next.forms[0].category).toBe("identity");
    });

    it("does not mutate the caller's previously-read copy", async () => {
      await service.setDraft(draftWith("example.com", "/login"));
      const read = await service.getDraft("example.com", "/login");

      await service.updateDraft("example.com", "/login", (d) => {
        d.irrelevant = true;
      });

      expect(read.irrelevant).toBe(false);
    });

    // Background capture and the open panel both write this key. A whole-object
    // write from a stale read silently drops whatever landed in between.
    it("keeps a write that landed after the caller last read", async () => {
      // The background reads, then awaits a content-script round trip.
      const beforeRoundTrip = await service.getDraft("example.com", "/login");

      // Meanwhile the panel marks the page irrelevant.
      await service.updateDraft("example.com", "/login", (d) => {
        d.irrelevant = true;
      });

      // The content script answers; the background records its capture.
      expect(beforeRoundTrip.irrelevant).toBe(false);
      await service.updateDraft("example.com", "/login", (d) => {
        d.forms[0].fields.username = [{ selector: "#u", warnings: [], alternates: [] }];
      });

      const final = await service.getDraft("example.com", "/login");
      expect(final.forms[0].fields.username).toHaveLength(1);
      expect(final.irrelevant).toBe(true);
    });
  });

  describe("clearDraft", () => {
    it("removes the draft for the key, reverting to empty", async () => {
      await service.setDraft(draftWith("example.com", "/login"));

      await service.clearDraft("example.com", "/login");

      const draft = await service.getDraft("example.com", "/login");
      expect(draft).toEqual(emptyDraft("example.com", "/login"));
    });

    it("leaves drafts under other keys intact", async () => {
      const keep = draftWith("other.com", "/signup");
      await service.setDraft(draftWith("example.com", "/login"));
      await service.setDraft(keep);

      await service.clearDraft("example.com", "/login");

      expect(await service.getDraft("other.com", "/signup")).toEqual(keep);
    });

    it("is a no-op when no draft exists for the key", async () => {
      await expect(service.clearDraft("example.com", "/login")).resolves.toBeUndefined();

      const draft = await service.getDraft("example.com", "/login");
      expect(draft).toEqual(emptyDraft("example.com", "/login"));
    });
  });
});
