import { UserId } from "@bitwarden/common/types/guid";

import { TransitionValidity } from "./enums";
import type { BufferedTransitionReport } from "./types";
import { registerTransition, transitionKey, validateTransition } from "./utils";

const userId = "user-1" as UserId;

function report(
  tabId: number,
  frameId: number | undefined,
  documentId: string,
  expiresAt = Number.MAX_SAFE_INTEGER,
  stampedAt = 0,
): BufferedTransitionReport {
  return { userId, tabId, frameId, documentId, stampedAt, expiresAt };
}

describe("registerTransition", () => {
  const options = { now: 1_000, maxAgeMs: 500 };

  it("rejects a report without a userId", () => {
    expect(
      registerTransition({ userId: undefined, tabId: 1, frameId: 0, documentId: "d" }, options),
    ).toBe(undefined);
  });

  it("rejects a report without a tabId", () => {
    expect(
      registerTransition({ userId, tabId: undefined, frameId: 0, documentId: "d" }, options),
    ).toBe(undefined);
  });

  it("rejects a report without a documentId", () => {
    expect(
      registerTransition({ userId, tabId: 1, frameId: 0, documentId: undefined }, options),
    ).toBe(undefined);
  });

  it("rejects a report with an empty documentId", () => {
    expect(registerTransition({ userId, tabId: 1, frameId: 0, documentId: "" }, options)).toBe(
      undefined,
    );
  });

  it("stamps tab 0 and frame 0", () => {
    expect(registerTransition({ userId, tabId: 0, frameId: 0, documentId: "d" }, options)).toEqual(
      expect.objectContaining({ tabId: 0, frameId: 0 }),
    );
  });

  it("stamps the admission time and an absolute deadline", () => {
    expect(registerTransition({ userId, tabId: 1, frameId: 2, documentId: "d" }, options)).toEqual({
      userId,
      tabId: 1,
      frameId: 2,
      documentId: "d",
      stampedAt: 1_000,
      expiresAt: 1_500,
    });
  });

  it("stamps a report from the top frame whose frameId is absent", () => {
    expect(
      registerTransition({ userId, tabId: 1, frameId: undefined, documentId: "d" }, options),
    ).toEqual(expect.objectContaining({ tabId: 1, frameId: undefined }));
  });
});

describe("validateTransition", () => {
  const resolved = report(1, 0, "doc-a", 1_000);

  it("is Valid for a live frame showing the reported document", () => {
    expect(validateTransition(resolved, { documentId: "doc-a" }, 999)).toBe(
      TransitionValidity.Valid,
    );
  });

  it("is Expired at the deadline", () => {
    expect(validateTransition(resolved, { documentId: "doc-a" }, 1_000)).toBe(
      TransitionValidity.Expired,
    );
  });

  it.each([
    ["no live frame", undefined],
    ["an unidentified live frame", { documentId: undefined }],
    ["a different document", { documentId: "doc-b" }],
  ])("is Expired before it is judged against %s", (_name, live) => {
    expect(validateTransition(resolved, live, 2_000)).toBe(TransitionValidity.Expired);
  });

  it("is FrameGone when there is no live frame", () => {
    expect(validateTransition(resolved, undefined, 0)).toBe(TransitionValidity.FrameGone);
  });

  it("is Unverifiable, not FrameGone, when the live frame has no documentId", () => {
    expect(validateTransition(resolved, { documentId: undefined }, 0)).toBe(
      TransitionValidity.Unverifiable,
    );
  });

  it("is DocumentChanged when the frame shows another document", () => {
    expect(validateTransition(resolved, { documentId: "doc-b" }, 0)).toBe(
      TransitionValidity.DocumentChanged,
    );
  });
});

describe("transitionKey", () => {
  it("begins with the tab's id", () => {
    expect(transitionKey({ tabId: 12, frameId: 3 }).startsWith("12:")).toBe(true);
  });

  it("tells the top frame from frame 0", () => {
    expect(transitionKey({ tabId: 1, frameId: undefined })).not.toEqual(
      transitionKey({ tabId: 1, frameId: 0 }),
    );
  });

  it("tells tab 1 from tab 10", () => {
    expect(transitionKey({ tabId: 10, frameId: 0 }).startsWith(`${1}:`)).toBe(false);
  });
});
