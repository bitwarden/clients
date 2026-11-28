import type { LiveFrame } from "../../../lifecycle/transition-buffer";
import { NEVER_CANCEL } from "../../../utils/cancellation";
import { TargetSource } from "../../enums";
import { AUTOFILL_DENIED, AUTOFILL_INVALID } from "../../utils";
import type { FillRequest, FillTarget } from "../context";
import {
  fakeServices,
  FRAME_DOCUMENT,
  tabTarget,
  NOW,
  reportedTarget as reportedFillTarget,
  requests,
  tab,
  TAB_ID,
  TOP_DOCUMENT,
  type FakeServices,
} from "../fakes.spec-util";

import { targetFromRequest, reportedTarget, targetPhase, verifyTarget } from "./target";

const UNNAMED: LiveFrame = { documentId: undefined };

describe("targetPhase", () => {
  it.each<[string, TargetSource, FillRequest, FillRequest]>([
    [
      "user's target, which refuses a reported request",
      TargetSource.User,
      requests.tab(),
      requests.reported(),
    ],
    [
      "policy's target, which refuses a reported request",
      TargetSource.Policy,
      requests.tab(),
      requests.reported(),
    ],
    [
      "reported target, which refuses a tab request",
      TargetSource.Reported,
      requests.reported(),
      requests.tab(),
    ],
  ])("builds the %s", async (_, source, own, other) => {
    const f = fakeServices();
    const phase = targetPhase({ source }, f.services);

    expect(await phase.check(own, NEVER_CANCEL)).toBeUndefined();
    expect(await phase.check(other, NEVER_CANCEL)).toBe(AUTOFILL_INVALID);
  });
});

describe("targetFromRequest", () => {
  describe("check", () => {
    it("lets the fill continue when the tab's top frame was named when the fill was requested", async () => {
      const f = fakeServices();

      const result = await targetFromRequest(f.services).check(requests.tab(), NEVER_CANCEL);

      expect(result).toBeUndefined();
    });

    it("denies a tab without an id", async () => {
      const f = fakeServices();
      const request = { ...requests.tab(), tab: { ...tab, id: undefined } } as FillRequest;

      const result = await targetFromRequest(f.services).check(request, NEVER_CANCEL);

      expect(result).toBe(AUTOFILL_DENIED);
    });

    it("denies a tab whose top frame was gone when the fill was requested", async () => {
      const f = fakeServices();

      const result = await targetFromRequest(f.services).check(
        requests.tab(undefined),
        NEVER_CANCEL,
      );

      expect(result).toBe(AUTOFILL_DENIED);
    });

    it("makes a request without a tab invalid, with a warning", async () => {
      const f = fakeServices();

      const result = await targetFromRequest(f.services).check(requests.reported(), NEVER_CANCEL);

      expect(result).toBe(AUTOFILL_INVALID);
      expect(f.logService.warning).toHaveBeenCalledTimes(1);
    });
  });

  describe("execute", () => {
    it("records the tab, its URL, and the document captured when the fill was requested", async () => {
      const f = fakeServices();

      const result = await targetFromRequest(f.services).execute(requests.tab(), NEVER_CANCEL);

      expect(result).toEqual({ target: tabTarget });
    });

    it("records the frame the request names", async () => {
      const f = fakeServices();
      const request = { ...requests.tab(), frameId: 5 } as FillRequest;

      const result = await targetFromRequest(f.services).execute(request, NEVER_CANCEL);

      expect(result).toEqual({ target: { ...tabTarget, frameId: 5 } });
    });
  });
});

describe("reportedTarget", () => {
  describe("check", () => {
    it.each<[string, number | undefined, string]>([
      ["a sub-frame", 3, FRAME_DOCUMENT],
      ["the top frame, by id", 0, TOP_DOCUMENT],
      ["the top frame, without an id", undefined, TOP_DOCUMENT],
    ])(
      "lets the fill continue when %s still holds the reported document",
      async (_, frameId, documentId) => {
        const f = fakeServices();

        const result = await reportedTarget(f.services).check(
          requests.reported({ frameId, documentId }),
          NEVER_CANCEL,
        );

        expect(result).toBeUndefined();
      },
    );

    it.each<[string, Parameters<typeof requests.reported>[0], (f: FakeServices) => void]>([
      ["the report has expired", { expiresAt: NOW }, () => undefined],
      ["the reporting frame is gone", {}, (f) => f.frames.delete(3)],
      [
        "the reporting frame holds another document",
        {},
        (f) => f.frames.set(3, { documentId: "another-document" }),
      ],
      ["the report names another tab", { tabId: TAB_ID + 1 }, () => undefined],
    ])("denies the fill when %s", async (_, report, arrange) => {
      const f = fakeServices();
      arrange(f);

      const result = await reportedTarget(f.services).check(
        requests.reported(report),
        NEVER_CANCEL,
      );

      expect(result).toBe(AUTOFILL_DENIED);
    });
  });

  describe("execute", () => {
    it("records the live tab, the reporting frame, the report's URL, the top frame's document, and the report", async () => {
      const f = fakeServices();

      const result = await reportedTarget(f.services).execute(
        requests.reported({ url: "https://example.com/reported" }),
        NEVER_CANCEL,
      );

      expect(result).toEqual({
        target: { ...reportedFillTarget, url: "https://example.com/reported" },
      });
    });

    it("records a report from the top frame without an id as the top frame", async () => {
      const f = fakeServices();

      const result = await reportedTarget(f.services).execute(
        requests.reported({ frameId: undefined, documentId: TOP_DOCUMENT }),
        NEVER_CANCEL,
      );

      expect(result).toEqual({
        target: expect.objectContaining({
          frameId: 0,
          report: { frameId: undefined, documentId: TOP_DOCUMENT, expiresAt: NOW + 1 },
        }),
      });
    });

    it.each<[string, (f: FakeServices) => void]>([
      ["the tab is gone", (f) => f.closeTab()],
      ["the top frame is gone", (f) => f.frames.delete(0)],
    ])("denies the fill when %s", async (_, arrange) => {
      const f = fakeServices();
      arrange(f);

      const result = await reportedTarget(f.services).execute(requests.reported(), NEVER_CANCEL);

      expect(result).toBe(AUTOFILL_DENIED);
    });
  });
});

describe("verifyTarget", () => {
  it.each<[string, FillTarget]>([
    ["a tab request's target", tabTarget],
    ["a reported target", reportedFillTarget],
  ])("lets the fill continue when the browser still holds %s", async (_, target) => {
    const f = fakeServices();

    const result = await verifyTarget(target, f.services);

    expect(result).toBeUndefined();
  });

  it("verifies a tab request's target by its tab and top frame alone", async () => {
    const f = fakeServices();

    await verifyTarget(tabTarget, f.services);

    expect(f.browser.frame).toHaveBeenCalledTimes(1);
    expect(f.browser.frame).toHaveBeenCalledWith(TAB_ID, 0);
  });

  it.each<[string, FillTarget, (f: FakeServices) => void]>([
    ["the tab is gone", tabTarget, (f) => f.closeTab()],
    ["the top frame is gone", tabTarget, (f) => f.frames.delete(0)],
    [
      "the top frame holds another document",
      tabTarget,
      (f) => f.frames.set(0, { documentId: "another-document" }),
    ],
    [
      "the reporting frame holds another document",
      reportedFillTarget,
      (f) => f.frames.set(3, { documentId: "another-document" }),
    ],
    ["the reporting frame is gone", reportedFillTarget, (f) => f.frames.delete(3)],
    [
      "the report has expired",
      { ...reportedFillTarget, report: { frameId: 3, documentId: FRAME_DOCUMENT, expiresAt: NOW } },
      () => undefined,
    ],
  ])("denies the fill when %s", async (_, target, arrange) => {
    const f = fakeServices();
    arrange(f);

    const result = await verifyTarget(target, f.services);

    expect(result).toBe(AUTOFILL_DENIED);
  });
});

// Every place the target reads a document reports one the browser does not name alike.
describe.each<[string, (f: FakeServices) => void, (f: FakeServices) => Promise<unknown>]>([
  [
    "targetFromRequest's check, for the captured top frame",
    () => undefined,
    (f) => targetFromRequest(f.services).check(requests.tab(UNNAMED), NEVER_CANCEL),
  ],
  [
    "reportedTarget's check, for the reporting frame",
    (f) => f.frames.set(3, UNNAMED),
    (f) => reportedTarget(f.services).check(requests.reported(), NEVER_CANCEL),
  ],
  [
    "reportedTarget's execute, for the top frame",
    (f) => f.frames.set(0, UNNAMED),
    (f) => reportedTarget(f.services).execute(requests.reported(), NEVER_CANCEL),
  ],
  [
    "verifyTarget, for the top frame",
    (f) => f.frames.set(0, UNNAMED),
    (f) => verifyTarget(reportedFillTarget, f.services),
  ],
  [
    "verifyTarget, for the reporting frame",
    (f) => f.frames.set(3, UNNAMED),
    (f) => verifyTarget(reportedFillTarget, f.services),
  ],
])("an unnamed document in %s", (_, arrange, act) => {
  it("makes the fill invalid, with a warning", async () => {
    const f = fakeServices();
    arrange(f);

    const result = await act(f);

    expect(result).toBe(AUTOFILL_INVALID);
    expect(f.logService.warning).toHaveBeenCalledTimes(1);
  });
});
