import {
  debounce,
  defaultIfEmpty,
  filter,
  firstValueFrom,
  map,
  switchMap,
  take,
  takeUntil,
  timer,
} from "rxjs";

import type { PageDetail } from "../../../services/abstractions/autofill.service";
import type { CancellationToken } from "../../../utils/cancellation";
import type { FillResult } from "../../types";
import { AUTOFILL_ABSENT, AUTOFILL_CANCELLED } from "../../utils";
import type { FillTarget, Paged, ReadContext } from "../context";
import { FillRequestKind, PageSource } from "../enums";
import { defaultFillTimings, type FillServices, type FillTimings } from "../services";
import type { FillPhase, ReadPlan } from "../types";

import { invalid, REQUEST_MISMATCH } from "./results";
import { verifyTarget, type TargetServices } from "./target";

const MONITORING_UNAVAILABLE = "the tab's monitoring state is unavailable";

/** The services a read's check works with. */
export type ReadCheckServices = TargetServices & Pick<FillServices, "monitoring$">;

/** The services the collecting read works with. */
export type ReadServices = ReadCheckServices & Pick<FillServices, "autofillService">;

/** The read a plan's read sub-plan calls for. */
export function readPhase(
  plan: ReadPlan,
  services: ReadServices,
  timings: Pick<FillTimings, "collectSettleMs$"> = defaultFillTimings,
): FillPhase<ReadContext, Paged> {
  switch (plan.source) {
    case PageSource.Collect:
      return collectPage(services, timings);
    case PageSource.FillRequest:
      return pageFromRequest(services);
  }
}

/**
 * The read of a fill that collects its page.
 *
 * When this phase executes, it collects the details of the target's frame, or of every frame of its
 * tab once their answers settle, and keeps the frames that offer fields. A collect that ends without
 * an answer, or a page whose frames offer no fields, is absent.
 *
 * Checks:
 *  * The tab is monitoring. The check waits until it is; a monitoring state that ends first makes
 *    the fill invalid (see `model.md`, "A read waits for monitoring").
 *  * The tab holds the target's document, and for a reported target, the reporting frame holds the
 *    reported document within the report's deadline (see `model.md`, "The target").
 *
 * Supports cancellation.
 */
export function collectPage(
  services: ReadServices,
  timings: Pick<FillTimings, "collectSettleMs$"> = defaultFillTimings,
): FillPhase<ReadContext, Paged> {
  const { autofillService } = services;
  const settle = () =>
    timings.collectSettleMs$.pipe(
      take(1),
      switchMap((settleMs) => timer(settleMs)),
    );
  return {
    check: async ({ target }, cancellation) => checkReadable(target, services, cancellation),
    execute: async ({ target }, cancellation) => {
      const collected$ = autofillService.collectPageDetailsFromTab$(target.tab, target.frameId);
      // A frame answers once; only a tab's frames need to settle.
      const answer$ =
        target.frameId == null ? collected$.pipe(debounce(settle), take(1)) : collected$;
      const answer = await firstValueFrom(
        answer$.pipe(
          map((pageDetails) => ({ pageDetails })),
          defaultIfEmpty("ended" as const),
          takeUntil(cancellation.cancelled$),
        ),
        { defaultValue: "cancelled" as const },
      );
      switch (answer) {
        case "cancelled":
          return AUTOFILL_CANCELLED;
        case "ended":
          return AUTOFILL_ABSENT;
      }
      const page = answer.pageDetails.filter(offersFields);
      return page.length ? { page } : AUTOFILL_ABSENT;
    },
  };
}

/**
 * The read of a fill that carries its page.
 *
 * When this phase executes, it takes the page details the request carries, and keeps the frames that
 * offer fields. It collects nothing. A page whose frames offer no fields is absent.
 *
 * Checks:
 *  * The request carries page details.
 *  * The tab is monitoring. The check waits until it is; a monitoring state that ends first makes
 *    the fill invalid (see `model.md`, "A read waits for monitoring").
 *  * The tab holds the target's document, and for a reported target, the reporting frame holds the
 *    reported document within the report's deadline (see `model.md`, "The target").
 *
 * Supports cancellation.
 */
export function pageFromRequest(services: ReadCheckServices): FillPhase<ReadContext, Paged> {
  return {
    check: async (context, cancellation) =>
      context.kind === FillRequestKind.Page
        ? checkReadable(context.target, services, cancellation)
        : invalid(services.logService, REQUEST_MISMATCH),
    execute: async (context) => {
      // The check verified this; this narrows it.
      if (context.kind !== FillRequestKind.Page) {
        return invalid(services.logService, REQUEST_MISMATCH);
      }
      const page = context.pageDetails.filter(offersFields);
      return page.length ? { page } : AUTOFILL_ABSENT;
    },
  };
}

/** Whether a frame's details offer fields to fill. */
function offersFields({ details }: PageDetail): boolean {
  return !!details?.fields?.length;
}

/**
 * Waits until the target's tab is monitoring, then verifies the target. The wait ends one of three
 * ways, and each decides the check: monitoring starts, the monitoring state ends first and the fill
 * is invalid, or the token is cancelled first and the fill is cancelled.
 */
async function checkReadable(
  target: FillTarget,
  services: ReadCheckServices,
  cancellation: CancellationToken,
): Promise<FillResult | undefined> {
  const ending = await firstValueFrom(
    services.monitoring$(target.tabId).pipe(
      filter((monitoring) => monitoring),
      map(() => "monitoring" as const),
      defaultIfEmpty("ended" as const),
      takeUntil(cancellation.cancelled$),
    ),
    { defaultValue: "cancelled" as const },
  );
  switch (ending) {
    case "cancelled":
      return AUTOFILL_CANCELLED;
    case "ended":
      return invalid(services.logService, MONITORING_UNAVAILABLE);
    case "monitoring":
      return verifyTarget(target, services);
  }
}
