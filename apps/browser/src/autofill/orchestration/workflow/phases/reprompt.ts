import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";

import { AUTOFILL_DENIED } from "../../utils";
import type { FillContext } from "../context";
import { CipherSource, RepromptAction } from "../enums";
import type { FillServices } from "../services";
import type { FillPhase, NoAddition, RepromptPlan } from "../types";

import { NO_CHECK } from "./checks";
import { invalid } from "./results";

const UNCONFIRMED_REPROMPT =
  "a cipher that requires a reprompt was selected, but the user confirmed only the requested cipher";

/** The services the reprompt phases work with. */
export type RepromptServices = Pick<
  FillServices,
  "autofillService" | "fillCipherPolicy" | "logService"
>;

/** The reprompt phase a plan's reprompt sub-plan calls for. */
export function repromptPhase(
  plan: RepromptPlan,
  services: RepromptServices,
): FillPhase<FillContext, NoAddition> {
  switch (plan.action) {
    case RepromptAction.Ask:
      return askReprompt(services, plan.cycleOnDenial);
    case RepromptAction.Refuse:
      return refuseReprompt();
    case RepromptAction.Confirmed:
      return confirmedReprompt(services);
  }
}

/**
 * The reprompt of a fill that can prompt the user.
 *
 * When this phase executes, it inspects the selected cipher to determine whether reprompt
 * is required. A required reprompt denies the fill, and the user's confirmation generates a new fill request. When
 * `cycleOnDenial` is set, the denial cycles the rotation past the cipher. A cipher that requires no reprompt lets
 * the fill continue.
 *
 * Checks: none.
 */
export function askReprompt(
  { autofillService, fillCipherPolicy }: RepromptServices,
  cycleOnDenial: boolean,
): FillPhase<FillContext, NoAddition> {
  return {
    check: NO_CHECK,
    execute: async ({ target, selection }) => {
      if (!(await autofillService.isPasswordRepromptRequired(selection.cipher, target.tab))) {
        return {};
      }
      if (cycleOnDenial && selection.rotation) {
        fillCipherPolicy.advanceRotation(selection.rotation);
      }
      return AUTOFILL_DENIED;
    },
  };
}

/**
 * The reprompt of a fill that cannot prompt the user.
 *
 * When this phase executes, it adds nothing, and the fill continues.
 *
 * Checks:
 *  * The cipher does not require a master-password reprompt, whether or not the user has a master
 *    password. One that does denies the fill.
 */
export function refuseReprompt(): FillPhase<FillContext, NoAddition> {
  return {
    check: async ({ selection }) =>
      selection.cipher.reprompt === CipherRepromptType.Password ? AUTOFILL_DENIED : undefined,
    execute: async () => ({}),
  };
}

/**
 * The reprompt of a fill the user confirmed the reprompt for. The confirmation covers the cipher the
 * request carries.
 *
 * When this phase executes, it adds nothing, and the fill continues.
 *
 * Checks:
 *  * A cipher that requires a master-password reprompt is the one the request carries. Any other
 *    was never confirmed, and makes the fill invalid.
 */
export function confirmedReprompt({
  logService,
}: Pick<RepromptServices, "logService">): FillPhase<FillContext, NoAddition> {
  return {
    check: async ({ selection }) =>
      selection.cipher.reprompt === CipherRepromptType.Password &&
      selection.source !== CipherSource.FillRequest
        ? invalid(logService, UNCONFIRMED_REPROMPT)
        : undefined,
    execute: async () => ({}),
  };
}
