import {
  CipherSource,
  FillEffectKind,
  FillReattempt,
  FillRequestKind,
  RepromptAction,
  TargetSource,
} from "./enums";
import * as plans from "./plans";
import { commitAllowsInactiveTab, FillPlans } from "./plans";
import type { FillPlan } from "./types";

const entries = Object.entries(FillPlans) as [keyof typeof FillPlans, FillPlan][];

describe("commitAllowsInactiveTab", () => {
  it("does not allow an inactive tab when the sub-plan omits the opt-out", () => {
    expect(commitAllowsInactiveTab({})).toBe(false);
  });

  it.each<[string, symbol]>([
    ["a symbol of the same description", Symbol("workflow.allowInactiveTab")],
    ["the registry symbol of the same description", Symbol.for("workflow.allowInactiveTab")],
  ])("does not allow an inactive tab when the opt-out is keyed by %s", (_, key) => {
    const commit: Record<symbol, unknown> = { [key]: true };

    expect(commitAllowsInactiveTab(commit)).toBe(false);
  });

  it("does not export the opt-out's key", () => {
    expect(Object.values(plans).some((value) => typeof value === "symbol")).toBe(false);
  });
});

describe("FillPlans", () => {
  it("allows an inactive tab for the popup's fill alone", () => {
    const allowing = entries
      .filter(([, plan]) => commitAllowsInactiveTab(plan.commit))
      .map(([name]) => name);

    expect(allowing).toEqual(["popup"]);
  });

  it("re-attempts the eager fill alone", () => {
    const reattempting = entries
      .filter(([, plan]) => plan.reattempt === FillReattempt.SlowRender)
      .map(([name]) => name);

    expect(reattempting).toEqual(["eager"]);
  });

  it("traces the auto-submit step's target to a policy, and every other request-carried tab to the user", () => {
    const sources = Object.fromEntries(entries.map(([name, plan]) => [name, plan.target.source]));

    expect(sources).toEqual({
      eager: TargetSource.Reported,
      command: TargetSource.User,
      loginType: TargetSource.User,
      card: TargetSource.User,
      identity: TargetSource.User,
      autoSubmit: TargetSource.Policy,
      contextMenu: TargetSource.User,
      popup: TargetSource.User,
      inlineMenu: TargetSource.User,
    });
  });

  it("submits for the auto-submit step alone", () => {
    const submitting = entries
      .filter(([, plan]) => plan.commit.flags.autoSubmitLogin)
      .map(([name]) => name);

    expect(submitting).toEqual(["autoSubmit"]);
  });

  it("refuses untrusted iframes for the eager fill alone", () => {
    const refusing = entries
      .filter(([, plan]) => !plan.commit.flags.allowUntrustedIframe)
      .map(([name]) => name);

    expect(refusing).toEqual(["eager"]);
  });

  it("confirms the reprompt for the plans that fill the requested cipher, and only those", () => {
    const confirming = entries
      .filter(([, plan]) => plan.reprompt.action === RepromptAction.Confirmed)
      .map(([name]) => name);
    const requested = entries
      .filter(([, plan]) => plan.select.source === CipherSource.FillRequest)
      .map(([name]) => name);

    expect(confirming).toEqual(["contextMenu", "popup", "inlineMenu"]);
    expect(requested).toEqual(confirming);
  });

  it.each<[keyof typeof FillPlans, FillRequestKind]>([
    ["eager", FillRequestKind.Reported],
    ["command", FillRequestKind.Tab],
    ["loginType", FillRequestKind.Tab],
    ["card", FillRequestKind.Tab],
    ["identity", FillRequestKind.Tab],
    ["autoSubmit", FillRequestKind.Tab],
    ["contextMenu", FillRequestKind.Cipher],
    ["popup", FillRequestKind.Cipher],
    ["inlineMenu", FillRequestKind.Page],
  ])("%s accepts a %s request", (name, kind) => {
    expect(FillPlans[name].accepts).toBe(kind);
  });

  it.each<[keyof typeof FillPlans, FillEffectKind[]]>([
    [
      "eager",
      [FillEffectKind.RecordActivity, FillEffectKind.CopyTotp, FillEffectKind.RefreshOverlay],
    ],
    [
      "command",
      [
        FillEffectKind.RecordActivity,
        FillEffectKind.Cycle,
        FillEffectKind.CopyTotp,
        FillEffectKind.RefreshOverlay,
      ],
    ],
    ["loginType", [FillEffectKind.RecordActivity, FillEffectKind.Cycle]],
    ["card", [FillEffectKind.RecordActivity, FillEffectKind.Cycle]],
    ["identity", [FillEffectKind.RecordActivity, FillEffectKind.Cycle]],
    ["autoSubmit", [FillEffectKind.RecordActivity]],
    ["contextMenu", [FillEffectKind.RecordActivity]],
    ["popup", [FillEffectKind.RecordActivity]],
    ["inlineMenu", [FillEffectKind.RecordActivity]],
  ])("gives %s the effects of its entry point", (name, effects) => {
    expect([...FillPlans[name].effects].sort()).toEqual([...effects].sort());
  });

  it.each(entries)("freezes %s, each of its sub-plans, and its flags", (_, plan) => {
    expect(Object.isFrozen(plan)).toBe(true);
    for (const part of [plan.target, plan.read, plan.select, plan.reprompt, plan.commit]) {
      expect(Object.isFrozen(part)).toBe(true);
    }
    expect(Object.isFrozen(plan.commit.flags)).toBe(true);
  });

  it.each(entries)("states both flags only %s decides", (_, plan) => {
    expect(typeof plan.commit.flags.allowUntrustedIframe).toBe("boolean");
    expect(typeof plan.commit.flags.autoSubmitLogin).toBe("boolean");
  });
});
