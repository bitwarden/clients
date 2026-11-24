import type { UserId } from "@bitwarden/common/types/guid";
import type { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import type { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AUTOFILL_DENIED } from "../../utils";
import type { SelectContext, Selected } from "../context";
import { CipherSource, FillRequestKind, LoginChoice } from "../enums";
import type { FillServices } from "../services";
import type { FillPhase, SelectPlan } from "../types";

import { verifyAccount } from "./account";
import { invalid, REQUEST_MISMATCH } from "./results";

/**
 * How recently a login must have been launched for a {@link LoginChoice.Recent} choice to prefer it
 * over the last-used login for the URL.
 */
export const LOGIN_LAST_LAUNCHED_WINDOW_MS = 30000;

/** The rotation key card ciphers cycle under. It is the key `CipherService` caches cards under. */
export const CARD_ROTATION = "cardCiphers";
/**
 * The rotation key identity ciphers cycle under. It is the key `CipherService` caches identities
 * under.
 */
export const IDENTITY_ROTATION = "identityCiphers";

const NO_TARGET_URL = "the target tab has no URL";

/** The services the select phases work with. */
export type SelectServices = Pick<
  FillServices,
  "accountService" | "authService" | "cipherService" | "logService" | "now"
>;

/** The select phase a plan's select sub-plan calls for. */
export function selectPhase(
  plan: SelectPlan,
  services: SelectServices,
): FillPhase<SelectContext, Selected> {
  switch (plan.source) {
    case CipherSource.Login:
      return selectLogin(services, plan.choice);
    case CipherSource.Card:
      return selectCard(services);
    case CipherSource.Identity:
      return selectIdentity(services);
    case CipherSource.FillRequest:
      return cipherFromRequest(services);
  }
}

/**
 * The selection of a login for the target's URL.
 *
 * When this phase executes, it chooses a login from the request's account, as `choice` says: the
 * next login in the URL's rotation (`Next`); a login launched within
 * {@link LOGIN_LAST_LAUNCHED_WINDOW_MS}, else the last one used (`Recent`); or the same, among only
 * the logins allowed to fill eagerly (`ForEagerFill`). No login for the URL denies the fill.
 *
 * Checks:
 *  * The target has a URL. A target without one makes the fill invalid.
 *  * The request's account is the active account, and unlocked (see `model.md`, invariant 12).
 */
export function selectLogin(
  services: SelectServices,
  choice: LoginChoice,
): FillPhase<SelectContext, Selected> {
  const { cipherService, logService, now } = services;
  return {
    check: async ({ target, userId }) =>
      target.url ? verifyAccount(userId, services) : invalid(logService, NO_TARGET_URL),
    execute: async ({ target, userId }) => {
      // The check verified the URL; this narrows it.
      if (!target.url) {
        return AUTOFILL_DENIED;
      }
      const cipher = await loginFor(cipherService, now, target.url, userId, choice);
      return cipher
        ? { selection: { cipher, source: CipherSource.Login, rotation: target.url } }
        : AUTOFILL_DENIED;
    },
  };
}

/**
 * The selection of the next card.
 *
 * When this phase executes, it selects the next card in the request's account's rotation. No card
 * denies the fill.
 *
 * Checks:
 *  * The request's account is the active account, and unlocked (see `model.md`, invariant 12).
 */
export function selectCard(services: SelectServices): FillPhase<SelectContext, Selected> {
  return selectNext(services, CipherSource.Card, CARD_ROTATION, (ciphers, userId) =>
    ciphers.getNextCardCipher(userId),
  );
}

/**
 * The selection of the next identity.
 *
 * When this phase executes, it selects the next identity in the request's account's rotation. No
 * identity denies the fill.
 *
 * Checks:
 *  * The request's account is the active account, and unlocked (see `model.md`, invariant 12).
 */
export function selectIdentity(services: SelectServices): FillPhase<SelectContext, Selected> {
  return selectNext(services, CipherSource.Identity, IDENTITY_ROTATION, (ciphers, userId) =>
    ciphers.getNextIdentityCipher(userId),
  );
}

/**
 * The selection of the cipher the request carries.
 *
 * When this phase executes, it selects the cipher the request carries. The cipher has no rotation.
 *
 * Checks:
 *  * The request carries a cipher. A request without one makes the fill invalid.
 */
export function cipherFromRequest({
  logService,
}: Pick<SelectServices, "logService">): FillPhase<SelectContext, Selected> {
  return {
    check: async (context) =>
      carriesCipher(context) ? undefined : invalid(logService, REQUEST_MISMATCH),
    execute: async (context) =>
      // The check verified this; this narrows it.
      carriesCipher(context)
        ? { selection: { cipher: context.cipher, source: CipherSource.FillRequest } }
        : invalid(logService, REQUEST_MISMATCH),
  };
}

/** Whether a request carries a cipher. */
function carriesCipher(
  context: SelectContext,
): context is Extract<SelectContext, { cipher: unknown }> {
  return context.kind === FillRequestKind.Cipher || context.kind === FillRequestKind.Page;
}

function selectNext(
  services: SelectServices,
  source: typeof CipherSource.Card | typeof CipherSource.Identity,
  rotation: string,
  next: (ciphers: CipherService, userId: UserId) => Promise<CipherView | undefined | null>,
): FillPhase<SelectContext, Selected> {
  return {
    check: async ({ userId }) => verifyAccount(userId, services),
    execute: async ({ userId }) => {
      const cipher = await next(services.cipherService, userId);
      return cipher ? { selection: { cipher, source, rotation } } : AUTOFILL_DENIED;
    },
  };
}

/** The login `choice` selects for a URL, or `undefined` when there is none. */
async function loginFor(
  cipherService: CipherService,
  now: () => number,
  url: string,
  userId: UserId,
  choice: LoginChoice,
): Promise<CipherView | undefined> {
  if (choice === LoginChoice.Next) {
    return (await cipherService.getNextCipherForUrl(url, userId)) ?? undefined;
  }
  const forEagerFill = choice === LoginChoice.ForEagerFill;
  const launched = await cipherService.getLastLaunchedForUrl(url, userId, forEagerFill);
  const lastLaunched = launched?.localData?.lastLaunched;
  if (launched && lastLaunched && now() - lastLaunched.valueOf() < LOGIN_LAST_LAUNCHED_WINDOW_MS) {
    return launched;
  }
  return (await cipherService.getLastUsedForUrl(url, userId, forEagerFill)) ?? undefined;
}
