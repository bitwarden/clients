import { defer, of, Subject } from "rxjs";

import type { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import type { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AutofillOutcome } from "../../enums/autofill-outcome.enum";
import type { PageDetail } from "../../services/abstractions/autofill.service";
import { NEVER_CANCEL } from "../../utils/cancellation";
import type { FillResult } from "../types";
import { AUTOFILL_ABSENT, AUTOFILL_DENIED, AUTOFILL_INVALID } from "../utils";

import type { FillRequest, FillRequestOf } from "./context";
import { FillRequestKind } from "./enums";
import {
  cipherOf,
  fakeServices,
  FILLED,
  OTHER_USER,
  pageDetail,
  requests,
  tab,
  URL,
  USER,
  type FakeServices,
} from "./fakes.spec-util";
import { fillWorkflow } from "./fill-workflow";
import { CARD_ROTATION, IDENTITY_ROTATION } from "./phases/select";
import { FillPlans } from "./plans";
import type { FillTimings } from "./services";

type PlanName = keyof typeof FillPlans;

/** Timings that settle and re-attempt at once. */
const timings: FillTimings = { collectSettleMs$: of(0), slowRenderMs$: of(0) };
const otherTab = { id: 8 } as chrome.tabs.Tab;

/**
 * A distinct cipher for each lookup, and one the request carries, so the cipher a fill chose names
 * where it came from.
 */
const ciphers = Object.freeze({
  next: cipherOf("next"),
  used: cipherOf("used"),
  card: cipherOf("card"),
  identity: cipherOf("identity"),
  requested: cipherOf("requested"),
});

/** The page the fakes collect: one frame offering fields. */
const collected = [pageDetail(3, 1)];

/** Services whose collect answers with `pageDetails` once, and whose vault offers the lookups' ciphers. */
function arrange(pageDetails: PageDetail[] = collected): FakeServices {
  const f = fakeServices();
  f.autofillService.collectPageDetailsFromTab$.mockReturnValue(of(pageDetails));
  f.fillCipherPolicy.nextCipherForUrl.mockResolvedValue(ciphers.next);
  f.fillCipherPolicy.lastUsedForUrl.mockResolvedValue(ciphers.used);
  f.fillCipherPolicy.nextCardCipher.mockResolvedValue(ciphers.card);
  f.fillCipherPolicy.nextIdentityCipher.mockResolvedValue(ciphers.identity);
  return f;
}

function run(plan: PlanName, f: FakeServices, request: FillRequest, fillTimings = timings) {
  return fillWorkflow(FillPlans[plan], f.services, fillTimings)(request, NEVER_CANCEL);
}

/** A request of each kind. */
const requestOfKind: Record<FillRequestKind, () => FillRequest> = {
  [FillRequestKind.Reported]: () => requests.reported(),
  [FillRequestKind.Tab]: () => requests.tab(),
  [FillRequestKind.Cipher]: () => requests.cipher(ciphers.requested),
  [FillRequestKind.Page]: () => requests.page(collected, ciphers.requested),
};

/** The kind of request each plan's entry point makes. */
const kindFor: Record<PlanName, FillRequestKind> = {
  eager: FillRequestKind.Reported,
  command: FillRequestKind.Tab,
  loginType: FillRequestKind.Tab,
  card: FillRequestKind.Tab,
  identity: FillRequestKind.Tab,
  autoSubmit: FillRequestKind.Tab,
  contextMenu: FillRequestKind.Cipher,
  popup: FillRequestKind.Cipher,
  inlineMenu: FillRequestKind.Cipher,
  unsavedCipher: FillRequestKind.Page,
};

/** The request each plan's entry point makes. */
function requestFor(plan: PlanName): FillRequest {
  return requestOfKind[kindFor[plan]]();
}

/** The flags each plan's entry point fills with. */
const COMMAND = {
  skipLastUsed: false,
  skipUsernameOnlyFill: false,
  onlyEmptyFields: false,
  fillNewPassword: true,
  allowUntrustedIframe: true,
  allowTotpAutofill: true,
  autoSubmitLogin: false,
};
const CIPHER_TYPE = { ...COMMAND, fillNewPassword: false, allowTotpAutofill: false };
const REQUESTED_CIPHER_FLAGS = {
  fillNewPassword: true,
  allowTotpAutofill: true,
  allowUntrustedIframe: true,
  autoSubmitLogin: false,
};

describe("fillWorkflow", () => {
  // Each plan reproduces its entry point: the cipher it chooses, the flags it fills with, and what
  // follows a fill.
  it.each<
    [
      PlanName,
      CipherView,
      Record<string, unknown>,
      { rotation?: string; totp: boolean; overlay: boolean },
    ]
  >([
    [
      "eager",
      ciphers.used,
      {
        skipLastUsed: true,
        skipUsernameOnlyFill: true,
        onlyEmptyFields: true,
        fillNewPassword: false,
        allowUntrustedIframe: false,
        allowTotpAutofill: false,
        autoSubmitLogin: false,
      },
      { totp: true, overlay: true },
    ],
    ["command", ciphers.next, COMMAND, { rotation: URL, totp: true, overlay: true }],
    ["loginType", ciphers.next, COMMAND, { rotation: URL, totp: false, overlay: false }],
    ["card", ciphers.card, CIPHER_TYPE, { rotation: CARD_ROTATION, totp: false, overlay: false }],
    [
      "identity",
      ciphers.identity,
      CIPHER_TYPE,
      { rotation: IDENTITY_ROTATION, totp: false, overlay: false },
    ],
    [
      "autoSubmit",
      ciphers.used,
      {
        fillNewPassword: true,
        allowUntrustedIframe: true,
        allowTotpAutofill: true,
        autoSubmitLogin: true,
      },
      { totp: false, overlay: false },
    ],
    ["contextMenu", ciphers.requested, REQUESTED_CIPHER_FLAGS, { totp: false, overlay: false }],
    ["popup", ciphers.requested, REQUESTED_CIPHER_FLAGS, { totp: false, overlay: false }],
    ["inlineMenu", ciphers.requested, REQUESTED_CIPHER_FLAGS, { totp: false, overlay: false }],
    ["unsavedCipher", ciphers.requested, REQUESTED_CIPHER_FLAGS, { totp: false, overlay: false }],
  ])(
    "fills for %s with its entry point's cipher, flags, and effects",
    async (plan, cipher, flags, effects) => {
      const f = arrange();
      const filled: FillResult = { ...FILLED, totp: "123456", canAutoCopyTotp: true };
      f.autofillService.doAutoFill.mockResolvedValue(filled);

      const result = await run(plan, f, requestFor(plan));

      expect(result).toBe(filled);
      expect(f.autofillService.doAutoFill).toHaveBeenCalledWith({
        ...flags,
        tab,
        cipher,
        pageDetails: collected,
      });
      expect(f.accountService.setAccountActivity).toHaveBeenCalledWith(USER, expect.any(Date));
      if (effects.rotation) {
        expect(f.fillCipherPolicy.advanceRotation).toHaveBeenCalledWith(effects.rotation);
      } else {
        expect(f.fillCipherPolicy.advanceRotation).not.toHaveBeenCalled();
      }
      expect(f.platformUtilsService.copyToClipboard).toHaveBeenCalledTimes(effects.totp ? 1 : 0);
      expect(f.updateOverlayCiphers).toHaveBeenCalledTimes(effects.overlay ? 1 : 0);
    },
  );

  it("collects an eager fill's reporting frame, and every frame for a command", async () => {
    const reported = arrange();
    await run("eager", reported, requests.reported());
    const commanded = arrange();
    await run("command", commanded, requests.tab());

    expect(reported.autofillService.collectPageDetailsFromTab$).toHaveBeenCalledWith(tab, 3);
    expect(commanded.autofillService.collectPageDetailsFromTab$).toHaveBeenCalledWith(
      tab,
      undefined,
    );
  });

  it("collects every frame for the inline menu, and nothing for a page its request carries", async () => {
    const menu = arrange();
    await run("inlineMenu", menu, requestFor("inlineMenu"));
    const carried = arrange();
    await run("unsavedCipher", carried, requestFor("unsavedCipher"));

    expect(menu.autofillService.collectPageDetailsFromTab$).toHaveBeenCalledWith(tab, undefined);
    expect(carried.autofillService.collectPageDetailsFromTab$).not.toHaveBeenCalled();
  });

  // Each user fill that asks the user denies a cipher that requires a reprompt, and cycles past it.
  it.each<[PlanName, string]>([
    ["command", URL],
    ["loginType", URL],
    ["card", CARD_ROTATION],
    ["identity", IDENTITY_ROTATION],
  ])("asks the user for %s, denies, and cycles past the cipher", async (plan, rotation) => {
    const f = arrange();
    f.autofillService.isPasswordRepromptRequired.mockResolvedValue(true);

    const result = await run(plan, f, requestFor(plan));

    expect(result).toBe(AUTOFILL_DENIED);
    expect(f.fillCipherPolicy.advanceRotation).toHaveBeenCalledWith(rotation);
    expect(f.autofillService.doAutoFill).not.toHaveBeenCalled();
  });

  // An auto-submit step asks too, and leaves the rotation to user fills.
  it("asks the user for autoSubmit, denies, and cycles nothing", async () => {
    const f = arrange();
    f.autofillService.isPasswordRepromptRequired.mockResolvedValue(true);

    const result = await run("autoSubmit", f, requestFor("autoSubmit"));

    expect(result).toBe(AUTOFILL_DENIED);
    expect(f.autofillService.isPasswordRepromptRequired).toHaveBeenCalled();
    expect(f.fillCipherPolicy.advanceRotation).not.toHaveBeenCalled();
    expect(f.autofillService.doAutoFill).not.toHaveBeenCalled();
  });

  // A plan for a cipher the user chose asks too, should its caller not have, and cycles nothing.
  it.each<PlanName>(["contextMenu", "inlineMenu"])(
    "asks the user for %s, denies, and cycles nothing",
    async (plan) => {
      const f = arrange();
      f.autofillService.isPasswordRepromptRequired.mockResolvedValue(true);

      const result = await run(plan, f, requestFor(plan));

      expect(result).toBe(AUTOFILL_DENIED);
      expect(f.autofillService.isPasswordRepromptRequired).toHaveBeenCalledWith(
        ciphers.requested,
        tab,
      );
      expect(f.fillCipherPolicy.advanceRotation).not.toHaveBeenCalled();
      expect(f.autofillService.doAutoFill).not.toHaveBeenCalled();
    },
  );

  it("never asks the user on an eager fill, and denies a login that requires a reprompt", async () => {
    const f = arrange();
    f.fillCipherPolicy.lastUsedForUrl.mockResolvedValue(
      cipherOf("protected", { reprompt: CipherRepromptType.Password }),
    );

    const result = await run("eager", f, requests.reported());

    expect(result).toBe(AUTOFILL_DENIED);
    expect(f.autofillService.isPasswordRepromptRequired).not.toHaveBeenCalled();
  });

  it("never asks the user for an unsaved cipher, and denies one that requires a reprompt", async () => {
    const f = arrange();
    const protectedCipher = cipherOf("protected", { reprompt: CipherRepromptType.Password });

    const result = await run("unsavedCipher", f, requests.page(collected, protectedCipher));

    expect(result).toBe(AUTOFILL_DENIED);
    expect(f.autofillService.isPasswordRepromptRequired).not.toHaveBeenCalled();
    expect(f.autofillService.doAutoFill).not.toHaveBeenCalled();
  });

  // Every plan fills only for the request's account, active and unlocked.
  describe.each(Object.keys(FillPlans) as PlanName[])("%s", (plan) => {
    it.each<[string, (f: FakeServices) => void]>([
      ["another account is active", (f) => f.activeAccount$.next({ id: OTHER_USER } as Account)],
      ["no account is active", (f) => f.activeAccount$.next(null)],
      ["the request's account is locked", (f) => f.status$.next(AuthenticationStatus.Locked)],
    ])("denies the fill when %s", async (_, change) => {
      const f = arrange();
      change(f);

      const result = await run(plan, f, requestFor(plan));

      expect(result).toBe(AUTOFILL_DENIED);
      expect(f.autofillService.doAutoFill).not.toHaveBeenCalled();
    });
  });

  // Every plan, with every request of a kind its entry point does not make.
  it.each(
    (Object.keys(FillPlans) as PlanName[]).flatMap((plan) =>
      (Object.keys(requestOfKind) as FillRequestKind[])
        .filter((kind) => kind !== kindFor[plan])
        .map((kind) => [plan, kind] as const),
    ),
  )("makes %s's fill of a %s request invalid before any phase runs", async (plan, kind) => {
    const f = arrange();
    // Records each part of the request read; a phase reads more than its kind.
    const read: PropertyKey[] = [];
    const request = new Proxy(requestOfKind[kind](), {
      get: (target, key, receiver) => {
        read.push(key);
        return Reflect.get(target, key, receiver);
      },
    });

    const result = await run(plan, f, request);

    expect(result).toBe(AUTOFILL_INVALID);
    expect(read).toEqual(["kind"]);
    expect(f.logService.warning).toHaveBeenCalledTimes(1);
    expect(f.logService.warning).toHaveBeenCalledWith(
      "Autofill attempt invalid: the plan does not accept a request of this kind.",
    );
  });

  it.each<[PlanName, FillResult]>([
    ["popup", FILLED],
    ["contextMenu", AUTOFILL_DENIED],
  ])("ends %s's fill of an inactive tab as %s", async (plan, expected) => {
    const f = arrange();
    f.activate(otherTab);

    const result = await run(plan, f, requestFor(plan));

    expect(result).toBe(expected);
  });

  it("denies a fill whose tab was active when the page was collected, but not when it commits", async () => {
    const f = arrange();
    // The user switches tabs while the page is collected.
    f.autofillService.collectPageDetailsFromTab$.mockReturnValue(
      defer(() => {
        f.activate(otherTab);
        return of(collected);
      }),
    );

    const result = await run("contextMenu", f, requestFor("contextMenu"));

    expect(result).toBe(AUTOFILL_DENIED);
    // The commit reads the active tab after the collect; that read denies the fill.
    const [collectedAt] = f.autofillService.collectPageDetailsFromTab$.mock.invocationCallOrder;
    expect(f.browser.activeTab.mock.invocationCallOrder.at(-1)).toBeGreaterThan(collectedAt);
    expect(f.autofillService.doAutoFill).not.toHaveBeenCalled();
  });

  it("never lets the caller of a page its request carries submit", async () => {
    const f = arrange();
    const request = {
      ...requests.page(collected, ciphers.requested),
      // A caller's untyped flags may carry what only a plan decides.
      options: { focusedFieldOpid: "field", autoSubmitLogin: true },
    } as unknown as FillRequest;

    await run("unsavedCipher", f, request);

    expect(f.autofillService.doAutoFill).toHaveBeenCalledWith(
      expect.objectContaining({ focusedFieldOpid: "field", autoSubmitLogin: false }),
    );
  });

  it("types each plan's workflow to the kind of request it accepts", () => {
    const command = fillWorkflow(FillPlans.command, fakeServices().services);
    const tabRequest: FillRequestOf<typeof FillRequestKind.Tab> = {
      kind: FillRequestKind.Tab,
      userId: USER,
      tab,
      topFrame: Promise.resolve(undefined),
    };

    // Never called: the check is the type check.
    const typed = () => [
      command(tabRequest, NEVER_CANCEL),
      // @ts-expect-error A command accepts only a tab request.
      command(requests.cipher(), NEVER_CANCEL),
    ];

    expect(typed).toBeInstanceOf(Function);
  });

  describe("re-attempt", () => {
    it("re-attempts an absent eager fill once, after the slow-render wait", async () => {
      const f = arrange();
      f.autofillService.collectPageDetailsFromTab$
        .mockReturnValueOnce(of([pageDetail(3, 0)]))
        .mockReturnValueOnce(of(collected));
      const slowRender$ = new Subject<number>();

      const pending = run("eager", f, requests.reported(), {
        ...timings,
        slowRenderMs$: slowRender$,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(f.autofillService.collectPageDetailsFromTab$).toHaveBeenCalledTimes(1);

      slowRender$.next(0);

      expect(await pending).toBe(FILLED);
      expect(f.autofillService.collectPageDetailsFromTab$).toHaveBeenCalledTimes(2);
    });

    it("does not re-attempt an absent command", async () => {
      const f = arrange([pageDetail(0, 0)]);

      const result = await run("command", f, requests.tab());

      expect(result).toBe(AUTOFILL_ABSENT);
      expect(f.autofillService.collectPageDetailsFromTab$).toHaveBeenCalledTimes(1);
    });
  });

  it("settles a command's tab-wide collect by the tuned settle time", async () => {
    jest.useFakeTimers();
    try {
      const f = arrange();
      const answers$ = new Subject<PageDetail[]>();
      f.autofillService.collectPageDetailsFromTab$.mockReturnValue(answers$);
      let result: unknown;

      void run("command", f, requests.tab(), { ...timings, collectSettleMs$: of(80) }).then(
        (value) => (result = value),
      );
      await jest.advanceTimersByTimeAsync(0);
      answers$.next(collected);
      await jest.advanceTimersByTimeAsync(79);
      expect(f.autofillService.doAutoFill).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);
      await jest.advanceTimersByTimeAsync(0);

      expect(result).toBe(FILLED);
    } finally {
      jest.useRealTimers();
    }
  });

  it("logs a failed effect as an error, and keeps the fill's result", async () => {
    const f = arrange();
    const error = new Error("refresh failed");
    f.updateOverlayCiphers.mockRejectedValue(error);

    const result = await run("command", f, requests.tab());

    expect(result.outcome).toBe(AutofillOutcome.Filled);
    expect(f.logService.error).toHaveBeenCalledWith(error);
  });
});
