import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import type { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import type { FillCipherPolicy } from "../../../services/abstractions/fill-cipher-policy";
import { NEVER_CANCEL } from "../../../utils/cancellation";
import { AUTOFILL_DENIED, AUTOFILL_INVALID } from "../../utils";
import type { SelectContext } from "../context";
import { CipherSource, LoginChoice } from "../enums";
import {
  cipherOf,
  fakeServices,
  tabTarget as target,
  NOW,
  OTHER_USER,
  pageDetail,
  requests,
  URL,
  USER,
  type FakeServices,
} from "../fakes.spec-util";
import type { FillPhase } from "../types";

import {
  CARD_ROTATION,
  cipherFromRequest,
  IDENTITY_ROTATION,
  LOGIN_LAST_LAUNCHED_WINDOW_MS,
  selectCard,
  selectIdentity,
  selectLogin,
  selectPhase,
} from "./select";

const context: SelectContext = { ...requests.tab(), target, page: [pageDetail(0, 1)] };

// Every selection from the vault reads the request's account, and requires it active and unlocked.
describe.each<[string, (f: FakeServices) => FillPhase<SelectContext, object>]>([
  ["selectLogin", (f) => selectLogin(f.services, LoginChoice.Next)],
  ["selectCard", (f) => selectCard(f.services)],
  ["selectIdentity", (f) => selectIdentity(f.services)],
])("%s's check", (_, phaseOf) => {
  it("lets the fill continue when the request's account is active and unlocked", async () => {
    const f = fakeServices();

    const result = await phaseOf(f).check(context, NEVER_CANCEL);

    expect(result).toBeUndefined();
  });

  it.each<[string, (f: FakeServices) => void]>([
    ["another account is active", (f) => f.activeAccount$.next({ id: OTHER_USER } as never)],
    ["no account is active", (f) => f.activeAccount$.next(null)],
    ["the request's account is locked", (f) => f.status$.next(AuthenticationStatus.Locked)],
  ])("denies the fill when %s", async (_, arrange) => {
    const f = fakeServices();
    arrange(f);

    const result = await phaseOf(f).check(context, NEVER_CANCEL);

    expect(result).toBe(AUTOFILL_DENIED);
  });
});

describe("selectPhase", () => {
  it.each<[string, Parameters<typeof selectPhase>[0], keyof FillCipherPolicy]>([
    ["a login", { source: CipherSource.Login, choice: LoginChoice.Next }, "nextCipherForUrl"],
    ["a card", { source: CipherSource.Card }, "nextCardCipher"],
    ["an identity", { source: CipherSource.Identity }, "nextIdentityCipher"],
  ])("builds the selection of %s", async (_, plan, read) => {
    const f = fakeServices();

    await selectPhase(plan, f.services).execute(context, NEVER_CANCEL);

    expect(f.fillCipherPolicy[read]).toHaveBeenCalled();
  });

  it("builds the selection of the cipher the request carries", async () => {
    const f = fakeServices();
    const requested = cipherOf("requested");

    const result = await selectPhase({ source: CipherSource.FillRequest }, f.services).execute(
      { ...requests.cipher(requested), target, page: [] },
      NEVER_CANCEL,
    );

    expect(result).toEqual({ selection: { cipher: requested, source: CipherSource.FillRequest } });
  });
});

describe("selectLogin", () => {
  it("makes a target without a URL invalid, with a warning", async () => {
    const f = fakeServices();

    const result = await selectLogin(f.services, LoginChoice.Next).check(
      { ...context, target: { ...target, url: undefined } },
      NEVER_CANCEL,
    );

    expect(result).toBe(AUTOFILL_INVALID);
    expect(f.logService.warning).toHaveBeenCalledTimes(1);
  });

  it("takes the next login in the URL's rotation for the request's account", async () => {
    const f = fakeServices();
    const next = cipherOf("next");
    f.fillCipherPolicy.nextCipherForUrl.mockResolvedValue(next);

    const result = await selectLogin(f.services, LoginChoice.Next).execute(context, NEVER_CANCEL);

    expect(result).toEqual({
      selection: { cipher: next, source: CipherSource.Login, rotation: URL },
    });
    expect(f.fillCipherPolicy.nextCipherForUrl).toHaveBeenCalledWith(URL, USER);
  });

  it.each<[LoginChoice, string, boolean]>([
    [LoginChoice.Recent, "among every login", false],
    [LoginChoice.ForEagerFill, "among the logins allowed to fill eagerly", true],
  ])(
    "takes a login launched within the window for a %s choice, %s",
    async (choice, _, forEagerFill) => {
      const f = fakeServices();
      const launched = cipherOf("launched", {
        lastLaunched: NOW - LOGIN_LAST_LAUNCHED_WINDOW_MS + 1,
      });
      f.fillCipherPolicy.lastLaunchedForUrl.mockResolvedValue(launched);
      f.fillCipherPolicy.lastUsedForUrl.mockResolvedValue(cipherOf("used"));

      const result = await selectLogin(f.services, choice).execute(context, NEVER_CANCEL);

      expect(result).toEqual({
        selection: { cipher: launched, source: CipherSource.Login, rotation: URL },
      });
      expect(f.fillCipherPolicy.lastLaunchedForUrl).toHaveBeenCalledWith(URL, USER, forEagerFill);
    },
  );

  const lastLaunched: [string, CipherView | undefined][] = [
    [
      "launched at the window's edge",
      cipherOf("launched", { lastLaunched: NOW - LOGIN_LAST_LAUNCHED_WINDOW_MS }),
    ],
    ["never launched", cipherOf("launched")],
    ["absent", undefined],
  ];
  it.each<[LoginChoice, string, boolean, CipherView | undefined]>(
    [
      [LoginChoice.Recent, false],
      [LoginChoice.ForEagerFill, true],
    ].flatMap(([choice, forEagerFill]) =>
      lastLaunched.map(
        ([label, launched]) =>
          [choice, label, forEagerFill, launched] as [
            LoginChoice,
            string,
            boolean,
            CipherView | undefined,
          ],
      ),
    ),
  )(
    "takes the last-used login for a %s choice when the last-launched one is %s",
    async (choice, _, forEagerFill, launched) => {
      const f = fakeServices();
      const used = cipherOf("used");
      f.fillCipherPolicy.lastLaunchedForUrl.mockResolvedValue(launched as CipherView);
      f.fillCipherPolicy.lastUsedForUrl.mockResolvedValue(used);

      const result = await selectLogin(f.services, choice).execute(context, NEVER_CANCEL);

      expect(result).toEqual({
        selection: { cipher: used, source: CipherSource.Login, rotation: URL },
      });
      expect(f.fillCipherPolicy.lastUsedForUrl).toHaveBeenCalledWith(URL, USER, forEagerFill);
    },
  );

  it.each([LoginChoice.Next, LoginChoice.Recent, LoginChoice.ForEagerFill])(
    "denies a %s choice when there is no login for the URL",
    async (choice) => {
      const f = fakeServices();

      const result = await selectLogin(f.services, choice).execute(context, NEVER_CANCEL);

      expect(result).toBe(AUTOFILL_DENIED);
    },
  );
});

describe.each<
  [string, typeof selectCard, "nextCardCipher" | "nextIdentityCipher", CipherSource, string]
>([
  ["selectCard", selectCard, "nextCardCipher", CipherSource.Card, CARD_ROTATION],
  [
    "selectIdentity",
    selectIdentity,
    "nextIdentityCipher",
    CipherSource.Identity,
    IDENTITY_ROTATION,
  ],
])("%s", (_, select, next, source, rotation) => {
  it("takes the next cipher in the request's account's rotation", async () => {
    const f = fakeServices();
    const chosen = cipherOf("chosen");
    f.fillCipherPolicy[next].mockResolvedValue(chosen);

    const result = await select(f.services).execute(context, NEVER_CANCEL);

    expect(result).toEqual({ selection: { cipher: chosen, source, rotation } });
    expect(f.fillCipherPolicy[next]).toHaveBeenCalledWith(USER);
  });

  it("denies the fill when there is no cipher", async () => {
    const f = fakeServices();

    const result = await select(f.services).execute(context, NEVER_CANCEL);

    expect(result).toBe(AUTOFILL_DENIED);
  });
});

describe("cipherFromRequest", () => {
  it.each([
    ["a cipher request", requests.cipher],
    ["a page request", (cipher: CipherView) => requests.page(undefined, cipher)],
  ])("selects the cipher of %s, without a rotation", async (_, requestOf) => {
    const f = fakeServices();
    const requested = cipherOf("requested");

    const phase = cipherFromRequest(f.services);
    const requestContext: SelectContext = { ...requestOf(requested), target, page: [] };

    expect(await phase.check(requestContext, NEVER_CANCEL)).toBeUndefined();
    expect(await phase.execute(requestContext, NEVER_CANCEL)).toEqual({
      selection: { cipher: requested, source: CipherSource.FillRequest },
    });
  });

  it("makes a request without a cipher invalid, with a warning", async () => {
    const f = fakeServices();

    const result = await cipherFromRequest(f.services).check(context, NEVER_CANCEL);

    expect(result).toBe(AUTOFILL_INVALID);
    expect(f.logService.warning).toHaveBeenCalledTimes(1);
  });
});
