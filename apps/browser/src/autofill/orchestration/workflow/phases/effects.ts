import { shouldAutoCopyTotp } from "../../utils";
import type { FillContext } from "../context";
import { FillEffectKind } from "../enums";
import type { FillServices } from "../services";
import type { FillEffect } from "../types";

import { cycle } from "./rotation";

/** The services the effects work with. */
export type EffectServices = Pick<
  FillServices,
  "accountService" | "cipherService" | "platformUtilsService" | "updateOverlayCiphers" | "now"
>;

/**
 * The effect of `kind`, for a fill that filled. Effects run only after a commit that filled,
 * and never change its result.
 *
 * - Cycle advances the selection's rotation, so the next fill offers the next cipher. A cipher the
 *   request carries has no rotation, and cycles nothing.
 * - Copy TOTP copies the filled cipher's code when the user's preference permits it.
 * - Refresh overlay refreshes the inline menu's ciphers.
 * - Record activity records activity for the request's account.
 */
export function fillEffect(
  kind: FillEffectKind,
  services: EffectServices,
): FillEffect<FillContext> {
  const { accountService, cipherService, platformUtilsService, updateOverlayCiphers, now } =
    services;
  switch (kind) {
    case FillEffectKind.Cycle:
      return async ({ selection }) => {
        if (selection.rotation) {
          cycle(cipherService, selection.rotation);
        }
      };
    case FillEffectKind.CopyTotp:
      return async (_, result) => {
        if (shouldAutoCopyTotp(result)) {
          platformUtilsService.copyToClipboard(result.totp);
        }
      };
    case FillEffectKind.RefreshOverlay:
      return () => updateOverlayCiphers();
    case FillEffectKind.RecordActivity:
      return ({ userId }) => accountService.setAccountActivity(userId, new Date(now()));
  }
}
