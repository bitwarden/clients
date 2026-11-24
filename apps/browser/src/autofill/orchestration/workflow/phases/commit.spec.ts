import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import type { PageDetail } from "../../../services/abstractions/autofill.service";
import { NEVER_CANCEL } from "../../../utils/cancellation";
import { AUTOFILL_DENIED, AUTOFILL_INVALID } from "../../utils";
import type { FillOptions, FillContext } from "../context";
import {
  cipherOf,
  contextOf,
  FILLED,
  fakeServices,
  OTHER_USER,
  pageDetail,
  reportedTarget,
  requests,
  tab,
  type FakeServices,
} from "../fakes.spec-util";
import { FillPlans } from "../plans";
import type { CommitPlan } from "../types";

import { commitPhase } from "./commit";

const otherTab = { id: 8, url: "https://elsewhere.example" } as chrome.tabs.Tab;
const cipher = cipherOf("selected");
const page = [pageDetail(0, 1)];
const context = contextOf({ page, selection: { cipher, source: "login" } });
const plan: CommitPlan = { flags: { allowUntrustedIframe: false, autoSubmitLogin: false } };

/** A context whose request carries a cipher and the caller's `options`. */
function withFillOptions(options: FillOptions): FillContext {
  return { ...context, ...requests.cipher(cipher), options } as FillContext;
}

describe("commitPhase", () => {
  describe("check", () => {
    it("lets the fill continue when the target's tab is active, holds its document, and the account holds", async () => {
      const f = fakeServices();

      const result = await commitPhase(plan, f.services).check(context, NEVER_CANCEL);

      expect(result).toBeUndefined();
    });

    it.each<[string, (f: FakeServices) => void]>([
      ["another tab is active", (f) => f.activate(otherTab)],
      ["no tab is active", (f) => f.activate(undefined)],
      [
        "the tab no longer holds the target's document",
        (f) => f.frames.set(0, { documentId: "x" }),
      ],
      ["another account is active", (f) => f.activeAccount$.next({ id: OTHER_USER } as never)],
      ["the request's account is locked", (f) => f.status$.next(AuthenticationStatus.Locked)],
    ])("denies the fill when %s", async (_, arrange) => {
      const f = fakeServices();
      arrange(f);

      const result = await commitPhase(plan, f.services).check(context, NEVER_CANCEL);

      expect(result).toBe(AUTOFILL_DENIED);
    });

    it("denies the fill when a reported target's reporting frame holds another document", async () => {
      const f = fakeServices();
      f.frames.set(3, { documentId: "another-document" });

      const result = await commitPhase(plan, f.services).check(
        { ...context, target: reportedTarget },
        NEVER_CANCEL,
      );

      expect(result).toBe(AUTOFILL_DENIED);
    });

    it("makes the fill invalid when the browser does not name the tab's document", async () => {
      const f = fakeServices();
      f.frames.set(0, { documentId: undefined });

      const result = await commitPhase(plan, f.services).check(context, NEVER_CANCEL);

      expect(result).toBe(AUTOFILL_INVALID);
    });
  });

  // The popup's commit is the one sub-plan that allows an inactive tab.
  describe("check, for a sub-plan that allows an inactive tab", () => {
    const optOut = FillPlans.popup.commit;

    it("lets the fill continue on an inactive tab, without reading the active tab", async () => {
      const f = fakeServices();
      f.activate(otherTab);

      const result = await commitPhase(optOut, f.services).check(context, NEVER_CANCEL);

      expect(result).toBeUndefined();
      expect(f.browser.activeTab).not.toHaveBeenCalled();
    });

    it.each<[string, (f: FakeServices) => void]>([
      [
        "the tab no longer holds the target's document",
        (f) => f.frames.set(0, { documentId: "x" }),
      ],
      ["another account is active", (f) => f.activeAccount$.next({ id: OTHER_USER } as never)],
      ["the request's account is locked", (f) => f.status$.next(AuthenticationStatus.Locked)],
    ])("still denies the fill when %s", async (_, arrange) => {
      const f = fakeServices();
      f.activate(otherTab);
      arrange(f);

      const result = await commitPhase(optOut, f.services).check(context, NEVER_CANCEL);

      expect(result).toBe(AUTOFILL_DENIED);
    });
  });

  describe("execute", () => {
    it("fills the target's tab with the selected cipher, the page, and the plan's flags", async () => {
      const f = fakeServices();

      const result = await commitPhase(
        { flags: { ...plan.flags, fillNewPassword: true, onlyEmptyFields: true } },
        f.services,
      ).execute(context);

      expect(result).toBe(FILLED);
      expect(f.autofillService.doAutoFill).toHaveBeenCalledWith({
        tab,
        cipher,
        pageDetails: page,
        fillNewPassword: true,
        onlyEmptyFields: true,
        allowUntrustedIframe: false,
        autoSubmitLogin: false,
      });
    });

    it("lets the caller's flags override the plan's", async () => {
      const f = fakeServices();

      await commitPhase(
        { flags: { ...plan.flags, fillNewPassword: true, onlyEmptyFields: true } },
        f.services,
      ).execute(withFillOptions({ fillNewPassword: false, focusedFieldOpid: "field" }));

      expect(f.autofillService.doAutoFill).toHaveBeenCalledWith(
        expect.objectContaining({
          fillNewPassword: false,
          onlyEmptyFields: true,
          focusedFieldOpid: "field",
        }),
      );
    });

    it("never lets the caller decide untrusted iframes or submission", async () => {
      const f = fakeServices();
      const smuggled = { allowUntrustedIframe: true, autoSubmitLogin: true } as FillOptions;

      await commitPhase(
        { flags: { allowUntrustedIframe: false, autoSubmitLogin: false } },
        f.services,
      ).execute(withFillOptions(smuggled));

      expect(f.autofillService.doAutoFill).toHaveBeenCalledWith(
        expect.objectContaining({ allowUntrustedIframe: false, autoSubmitLogin: false }),
      );
    });

    it("never lets the flags replace the tab, the cipher, or the page", async () => {
      const f = fakeServices();
      const smuggled = { tab: otherTab, cipher: {}, pageDetails: [] as PageDetail[] };

      await commitPhase(
        { flags: { ...plan.flags, ...smuggled } } as unknown as CommitPlan,
        f.services,
      ).execute(withFillOptions(smuggled as unknown as FillOptions));

      expect(f.autofillService.doAutoFill).toHaveBeenCalledWith(
        expect.objectContaining({ tab, cipher, pageDetails: page }),
      );
    });
  });
});
