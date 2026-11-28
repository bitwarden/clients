import { EMPTY, firstValueFrom, Observable, of, Subject } from "rxjs";

import type { PageDetail } from "../../../services/abstractions/autofill.service";
import { cancellationToken, NEVER_CANCEL } from "../../../utils/cancellation";
import {
  AUTOFILL_ABSENT,
  AUTOFILL_CANCELLED,
  AUTOFILL_DENIED,
  AUTOFILL_INVALID,
} from "../../utils";
import type { ReadContext } from "../context";
import { PageSource } from "../enums";
import {
  fakeServices,
  tabTarget as target,
  pageDetail,
  reportedTarget,
  requests,
  tab,
  type FakeServices,
} from "../fakes.spec-util";
import { defaultFillTimings } from "../services";
import type { FillPhase } from "../types";

import { collectPage, pageFromRequest, readPhase } from "./read";

/** The settle time the tests tune, distinct from the default's. */
const SETTLE_MS = 80;
const timings = { collectSettleMs$: of(SETTLE_MS) };

const frameTarget = { ...target, frameId: 3 };
const tabContext: ReadContext = { ...requests.tab(), target };
const frameContext: ReadContext = { ...requests.tab(), target: frameTarget };
const pageContext = (pageDetails: PageDetail[] = [pageDetail(0, 1)]): ReadContext => ({
  ...requests.page(pageDetails),
  target,
});

/**
 * Whether a promise settled once every pending promise ran. Uses a real timer, so it needs real
 * timers.
 */
async function settled(promise: Promise<unknown>): Promise<boolean> {
  let done = false;
  void promise.then(() => (done = true));
  await new Promise((resolve) => setTimeout(resolve, 0));
  return done;
}

describe("readPhase", () => {
  it("builds the read that collects the target's page", async () => {
    const f = fakeServices();
    f.autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pageDetail(3, 1)]));

    await readPhase({ source: PageSource.Collect }, f.services).execute(frameContext, NEVER_CANCEL);

    expect(f.autofillService.collectPageDetailsFromTab$).toHaveBeenCalled();
  });

  it("builds the read of the page the request carries", async () => {
    const f = fakeServices();

    const result = await readPhase({ source: PageSource.FillRequest }, f.services).execute(
      pageContext(),
      NEVER_CANCEL,
    );

    expect(result).toEqual({ page: [pageDetail(0, 1)] });
    expect(f.autofillService.collectPageDetailsFromTab$).not.toHaveBeenCalled();
  });
});

// The two reads share their check.
describe.each<[string, (f: FakeServices) => FillPhase<ReadContext, object>]>([
  ["collectPage", (f) => collectPage(f.services)],
  ["pageFromRequest", (f) => pageFromRequest(f.services)],
])("%s's check", (_, phaseOf) => {
  it("lets the fill continue when the tab is monitoring and holds the target's document", async () => {
    const f = fakeServices();

    const result = await phaseOf(f).check(pageContext(), NEVER_CANCEL);

    expect(result).toBeUndefined();
  });

  it("waits until the tab is monitoring, and verifies the target only then", async () => {
    const f = fakeServices();
    f.monitoring$.next(false);

    const pending = phaseOf(f).check(pageContext(), NEVER_CANCEL);
    expect(await settled(pending)).toBe(false);
    expect(f.browser.tab).not.toHaveBeenCalled();

    f.monitoring$.next(true);

    expect(await pending).toBeUndefined();
    expect(f.browser.tab).toHaveBeenCalled();
  });

  it("makes the fill invalid, with a warning, when the monitoring state ends without monitoring", async () => {
    const f = fakeServices();
    f.monitoring$.next(false);
    const pending = phaseOf(f).check(pageContext(), NEVER_CANCEL);

    f.monitoring$.complete();

    expect(await pending).toBe(AUTOFILL_INVALID);
    expect(f.logService.warning).toHaveBeenCalledTimes(1);
  });

  it("makes the fill invalid when the monitoring state ends, though the token is cancelled after", async () => {
    const f = fakeServices();
    f.monitoring$.next(false);
    const { cancel, token } = cancellationToken();
    const pending = phaseOf(f).check(pageContext(), token);

    f.monitoring$.complete();
    cancel();

    expect(await pending).toBe(AUTOFILL_INVALID);
  });

  it("ends the wait, and the fill as cancelled without a warning, when the token is cancelled", async () => {
    const f = fakeServices();
    f.monitoring$.next(false);
    const { cancel, token } = cancellationToken();
    const pending = phaseOf(f).check(pageContext(), token);

    cancel();

    expect(await settled(pending)).toBe(true);
    expect(await pending).toBe(AUTOFILL_CANCELLED);
    expect(f.logService.warning).not.toHaveBeenCalled();
    expect(f.monitoring$.observed).toBe(false);
  });

  it("ends the fill as cancelled when the token was cancelled before the check", async () => {
    const f = fakeServices();
    f.monitoring$.next(false);
    const { cancel, token } = cancellationToken();
    cancel();

    const result = await phaseOf(f).check(pageContext(), token);

    expect(result).toBe(AUTOFILL_CANCELLED);
    expect(f.logService.warning).not.toHaveBeenCalled();
  });

  it("denies the fill when the tab no longer holds the target's document", async () => {
    const f = fakeServices();
    f.frames.set(0, { documentId: "another-document" });

    const result = await phaseOf(f).check(pageContext(), NEVER_CANCEL);

    expect(result).toBe(AUTOFILL_DENIED);
  });

  it("denies the fill when a reported target's reporting frame holds another document", async () => {
    const f = fakeServices();
    f.frames.set(3, { documentId: "another-document" });

    const result = await phaseOf(f).check(
      { ...pageContext(), target: reportedTarget },
      NEVER_CANCEL,
    );

    expect(result).toBe(AUTOFILL_DENIED);
  });
});

describe("collectPage's execute", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("collects every frame of the tab, and waits until their answers stop for the settle time", async () => {
    jest.useFakeTimers();
    const f = fakeServices();
    const first = pageDetail(0, 1);
    const second = pageDetail(4, 2);
    let result: unknown;

    void collectPage(f.services, timings)
      .execute(tabContext, NEVER_CANCEL)
      .then((value) => (result = value));
    f.collected$.next([first]);
    await jest.advanceTimersByTimeAsync(SETTLE_MS - 1);
    f.collected$.next([first, second]);
    await jest.advanceTimersByTimeAsync(SETTLE_MS - 1);
    // The second answer restarted the wait.
    expect(result).toBeUndefined();

    await jest.advanceTimersByTimeAsync(1);

    expect(result).toEqual({ page: [first, second] });
    expect(f.autofillService.collectPageDetailsFromTab$).toHaveBeenCalledWith(tab, undefined);
  });

  it("settles a tab-wide read by the default settle time when none is tuned", async () => {
    jest.useFakeTimers();
    const f = fakeServices();
    const defaultMs = await firstValueFrom(defaultFillTimings.collectSettleMs$);
    const first = pageDetail(0, 1);
    let result: unknown;

    void collectPage(f.services)
      .execute(tabContext, NEVER_CANCEL)
      .then((value) => (result = value));
    await jest.advanceTimersByTimeAsync(0);
    f.collected$.next([first]);
    await jest.advanceTimersByTimeAsync(defaultMs - 1);
    expect(result).toBeUndefined();

    await jest.advanceTimersByTimeAsync(1);

    expect(result).toEqual({ page: [first] });
  });

  it("asks for the collect at once, before a settle time is known", async () => {
    const f = fakeServices();

    void collectPage(f.services, { collectSettleMs$: new Subject<number>() }).execute(
      tabContext,
      NEVER_CANCEL,
    );

    expect(f.autofillService.collectPageDetailsFromTab$).toHaveBeenCalledTimes(1);
    expect(f.collected$.observed).toBe(true);
  });

  it("collects the target's frame, and takes its answer at once", async () => {
    const f = fakeServices();
    const detail = pageDetail(3, 1);

    const pending = collectPage(f.services).execute(frameContext, NEVER_CANCEL);
    f.collected$.next([detail]);

    expect(await settled(pending)).toBe(true);
    expect(await pending).toEqual({ page: [detail] });
    expect(f.autofillService.collectPageDetailsFromTab$).toHaveBeenCalledWith(tab, 3);
  });

  it("keeps only the frames that offer fields", async () => {
    const f = fakeServices();
    const offering = pageDetail(3, 1);
    f.autofillService.collectPageDetailsFromTab$.mockReturnValue(of([pageDetail(2, 0), offering]));

    const result = await collectPage(f.services).execute(frameContext, NEVER_CANCEL);

    expect(result).toEqual({ page: [offering] });
  });

  describe("a request that names which fields it may fill", () => {
    /** A frame whose fields are named by `names`. */
    const namedFields = (frameId: number, ...names: string[]): PageDetail =>
      ({
        frameId,
        tab,
        details: { fields: names.map((htmlName) => ({ htmlName })) },
      }) as unknown as PageDetail;
    const onlyPasswords = ({ htmlName }: { htmlName?: string }) => htmlName === "password";
    const restrictedContext = (): ReadContext =>
      ({ ...requests.cipher(), fields: onlyPasswords, target: frameTarget }) as ReadContext;

    it("keeps only those fields, and leaves the collected details as they were", async () => {
      const f = fakeServices();
      const collected = namedFields(3, "username", "password");
      f.autofillService.collectPageDetailsFromTab$.mockReturnValue(of([collected]));

      const result = await collectPage(f.services).execute(restrictedContext(), NEVER_CANCEL);

      expect(result).toEqual({ page: [namedFields(3, "password")] });
      expect(collected).toEqual(namedFields(3, "username", "password"));
    });

    it("drops a frame left with none of those fields", async () => {
      const f = fakeServices();
      f.autofillService.collectPageDetailsFromTab$.mockReturnValue(
        of([namedFields(3, "username"), namedFields(4, "password")]),
      );

      const result = await collectPage(f.services).execute(restrictedContext(), NEVER_CANCEL);

      expect(result).toEqual({ page: [namedFields(4, "password")] });
    });

    it("is absent when no frame is left with those fields", async () => {
      const f = fakeServices();
      f.autofillService.collectPageDetailsFromTab$.mockReturnValue(
        of([namedFields(3, "username")]),
      );

      const result = await collectPage(f.services).execute(restrictedContext(), NEVER_CANCEL);

      expect(result).toBe(AUTOFILL_ABSENT);
    });

    it("drops a frame whose details list no fields", async () => {
      const f = fakeServices();
      const fieldless = { frameId: 3, tab, details: {} } as unknown as PageDetail;
      f.autofillService.collectPageDetailsFromTab$.mockReturnValue(
        of([fieldless, namedFields(4, "password")]),
      );

      const result = await collectPage(f.services).execute(restrictedContext(), NEVER_CANCEL);

      expect(result).toEqual({ page: [namedFields(4, "password")] });
    });
  });

  it.each<[string, Observable<PageDetail[]>]>([
    ["no frame offers fields", of([pageDetail(3, 0)])],
    ["the collect ends without an answer", EMPTY],
  ])("is absent when %s", async (_, collected$) => {
    const f = fakeServices();
    f.autofillService.collectPageDetailsFromTab$.mockReturnValue(collected$);

    const result = await collectPage(f.services).execute(frameContext, NEVER_CANCEL);

    expect(result).toBe(AUTOFILL_ABSENT);
  });

  it("ends the fill as cancelled when the token is cancelled while a tab's answers settle", async () => {
    jest.useFakeTimers();
    const f = fakeServices();
    const { cancel, token } = cancellationToken();
    let result: unknown;

    void collectPage(f.services, timings)
      .execute(tabContext, token)
      .then((value) => (result = value));
    f.collected$.next([pageDetail(0, 1)]);
    await jest.advanceTimersByTimeAsync(SETTLE_MS - 1);
    cancel();
    await jest.advanceTimersByTimeAsync(0);

    expect(result).toBe(AUTOFILL_CANCELLED);
    expect(f.collected$.observed).toBe(false);
  });

  it("ends the fill as cancelled when the token is cancelled while it collects", async () => {
    const f = fakeServices();
    const { cancel, token } = cancellationToken();

    const pending = collectPage(f.services).execute(frameContext, token);
    cancel();

    expect(await pending).toBe(AUTOFILL_CANCELLED);
    expect(f.collected$.observed).toBe(false);
  });
});

describe("pageFromRequest", () => {
  it("keeps the frames of the page the request carries that offer fields, and collects nothing", async () => {
    const f = fakeServices();
    const offering = pageDetail(3, 1);

    const result = await pageFromRequest(f.services).execute(
      pageContext([pageDetail(2, 0), offering]),
      NEVER_CANCEL,
    );

    expect(result).toEqual({ page: [offering] });
    expect(f.autofillService.collectPageDetailsFromTab$).not.toHaveBeenCalled();
  });

  it.each<[string, PageDetail[]]>([
    ["no frame offers fields", [pageDetail(3, 0)]],
    ["the request carries no page details", []],
  ])("is absent when %s", async (_, pageDetails) => {
    const f = fakeServices();

    const result = await pageFromRequest(f.services).execute(
      pageContext(pageDetails),
      NEVER_CANCEL,
    );

    expect(result).toBe(AUTOFILL_ABSENT);
  });

  it("makes a request without page details invalid, with a warning", async () => {
    const f = fakeServices();

    const result = await pageFromRequest(f.services).check(tabContext, NEVER_CANCEL);

    expect(result).toBe(AUTOFILL_INVALID);
    expect(f.logService.warning).toHaveBeenCalledTimes(1);
  });
});
