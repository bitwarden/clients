import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import type { TargetSystemView, TargetSystemId } from "../rotation";
import { TargetSystemKind, TargetSystemMethod } from "../rotation";
import { sysId, targetSystem, targetSystemSealedFields } from "../testing/rotation-builders";

import { targetSystemLabel, targetSystemQualifierKey } from "./target-system-label";

/** Returns the key, with the qualified-name key rendered so its two halves stay readable. */
const i18nFake = {
  t: (id: string, p1?: string | number, p2?: string | number) =>
    id === "pamTargetSystemNameWithDetail" ? `${p1} (${p2})` : id,
} as I18nService;

function system(overrides: Partial<TargetSystemView> = {}): TargetSystemView {
  return targetSystem({ id: sysId("ts-1"), name: "dc01 AD domain accounts", ...overrides });
}

/** `system`, with its sealed `kind` overridden; the rest of `sealed` stays default. */
function systemWithKind(
  kind: TargetSystemKind | undefined,
  overrides: Partial<TargetSystemView> = {},
) {
  return system({ sealed: targetSystemSealedFields({ kind }), ...overrides });
}

describe("targetSystemQualifierKey", () => {
  it("uses the integration when there is one", () => {
    expect(targetSystemQualifierKey(systemWithKind(TargetSystemKind.Entra))).toBe(
      "pamTargetSystemTypeEntra",
    );
  });

  it("falls back to the method for a manual target, which has no integration", () => {
    expect(
      targetSystemQualifierKey(systemWithKind(undefined, { method: TargetSystemMethod.Manual })),
    ).toBe("pamTargetSystemMethodManual");
  });

  it("states nothing about an integration this version cannot name", () => {
    expect(
      targetSystemQualifierKey(
        systemWithKind(TargetSystemKind.Unknown, { method: TargetSystemMethod.Automatic }),
      ),
    ).toBeNull();
  });

  it("states nothing about a method this version cannot model either", () => {
    expect(
      targetSystemQualifierKey(systemWithKind(undefined, { method: TargetSystemMethod.Unknown })),
    ).toBeNull();
  });

  it("falls back to the method when sealed fields are unavailable", () => {
    expect(
      targetSystemQualifierKey(system({ method: TargetSystemMethod.Automatic, sealed: undefined })),
    ).toBe("pamTargetSystemMethodAutomatic");
  });
});

describe("targetSystemLabel", () => {
  it("tells two same-named targets apart by their integration", () => {
    const entra = targetSystemLabel(i18nFake, sysId("ts-1"), system());
    const script = targetSystemLabel(
      i18nFake,
      sysId("ts-2"),
      systemWithKind(TargetSystemKind.CustomScript, { id: sysId("ts-2") }),
    );

    expect(entra.name).toBe(script.name);
    expect(entra.qualified).not.toBe(script.qualified);
    expect(entra.qualified).toBe("dc01 AD domain accounts (pamTargetSystemTypeEntra)");
    expect(script.qualified).toBe("dc01 AD domain accounts (pamTargetSystemTypeCustomScript)");
  });

  it("leaves the name alone when there is no detail to add", () => {
    const label = targetSystemLabel(
      i18nFake,
      sysId("ts-1"),
      systemWithKind(TargetSystemKind.Unknown, { method: TargetSystemMethod.Automatic }),
    );

    expect(label.qualifierKey).toBeNull();
    expect(label.qualified).toBe("dc01 AD domain accounts");
  });

  it("falls back to the raw id when the target system has not resolved", () => {
    const id = sysId("ts-9") as TargetSystemId;
    const label = targetSystemLabel(i18nFake, id, undefined);

    expect(label.name).toBe(String(id));
    expect(label.qualified).toBe(String(id));
    expect(label.qualifierKey).toBeNull();
  });
});
