import { CipherSource, FillEffectKind } from "../enums";
import {
  cipherOf,
  contextOf,
  fakeServices,
  FILLED,
  NOW,
  OTHER_USER,
  URL,
} from "../fakes.spec-util";
import type { FillFilled } from "../types";

import { fillEffect } from "./effects";

const cipher = cipherOf("selected");
const rotated = contextOf({ selection: { cipher, source: CipherSource.Login, rotation: URL } });
const requested = contextOf({ selection: { cipher, source: CipherSource.FillRequest } });

describe("fillEffect", () => {
  describe("cycle", () => {
    it("advances the selection's rotation", async () => {
      const f = fakeServices();

      await fillEffect(FillEffectKind.Cycle, f.services)(rotated, FILLED);

      expect(f.cipherService.updateLastUsedIndexForUrl).toHaveBeenCalledWith(URL);
    });

    it("cycles nothing for a cipher the request carries", async () => {
      const f = fakeServices();

      await fillEffect(FillEffectKind.Cycle, f.services)(requested, FILLED);

      expect(f.cipherService.updateLastUsedIndexForUrl).not.toHaveBeenCalled();
    });
  });

  describe("copy TOTP", () => {
    it("copies the code when the user's preference permits it", async () => {
      const f = fakeServices();

      await fillEffect(FillEffectKind.CopyTotp, f.services)(rotated, {
        ...FILLED,
        totp: "123456",
        canAutoCopyTotp: true,
      });

      expect(f.platformUtilsService.copyToClipboard).toHaveBeenCalledWith("123456");
    });

    it.each<[string, Partial<FillFilled>]>([
      ["the preference does not permit it", { totp: "123456", canAutoCopyTotp: false }],
      ["there is no code", { canAutoCopyTotp: true }],
    ])("copies nothing when %s", async (_, result) => {
      const f = fakeServices();

      await fillEffect(FillEffectKind.CopyTotp, f.services)(rotated, { ...FILLED, ...result });

      expect(f.platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
    });
  });

  describe("refresh overlay", () => {
    it("refreshes the inline menu's ciphers", async () => {
      const f = fakeServices();

      await fillEffect(FillEffectKind.RefreshOverlay, f.services)(rotated, FILLED);

      expect(f.updateOverlayCiphers).toHaveBeenCalledTimes(1);
    });

    it("rejects when the refresh fails, so the workflow reports it", async () => {
      const f = fakeServices();
      const error = new Error("refresh failed");
      f.updateOverlayCiphers.mockRejectedValue(error);

      await expect(
        fillEffect(FillEffectKind.RefreshOverlay, f.services)(rotated, FILLED),
      ).rejects.toBe(error);
    });
  });

  describe("record activity", () => {
    it("records activity for the request's account, not the active one, now", async () => {
      const f = fakeServices();

      await fillEffect(FillEffectKind.RecordActivity, f.services)(
        { ...rotated, userId: OTHER_USER },
        FILLED,
      );

      expect(f.accountService.setAccountActivity).toHaveBeenCalledWith(OTHER_USER, new Date(NOW));
    });

    it("rejects when the record fails, so the workflow reports it", async () => {
      const f = fakeServices();
      const error = new Error("record failed");
      f.accountService.setAccountActivity.mockRejectedValue(error);

      await expect(
        fillEffect(FillEffectKind.RecordActivity, f.services)(rotated, FILLED),
      ).rejects.toBe(error);
    });
  });
});
