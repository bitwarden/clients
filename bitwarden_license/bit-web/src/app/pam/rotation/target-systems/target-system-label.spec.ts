import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import type { TargetSystem, TargetSystemId } from "../rotation";
import { TargetSystemKind, TargetSystemMethod } from "../rotation";
import { sysId, targetSystem } from "../testing/rotation-builders";

import { targetSystemLabel, targetSystemQualifierKey } from "./target-system-label";

/** Returns the key, with the qualified-name key rendered so its two halves stay readable. */
const i18nFake = {
  t: (id: string, p1?: string | number, p2?: string | number) =>
    id === "pamTargetSystemNameWithDetail" ? `${p1} (${p2})` : id,
} as I18nService;

function system(overrides: Partial<TargetSystem> = {}): TargetSystem {
  return targetSystem({ id: sysId("ts-1"), name: "dc01 AD domain accounts", ...overrides });
}

describe("targetSystemQualifierKey", () => {
  it("uses the integration when there is one", () => {
    expect(targetSystemQualifierKey(system({ kind: TargetSystemKind.Mssql }))).toBe(
      "pamTargetSystemKindMssql",
    );
  });

  it("falls back to the method for a manual target, which has no integration", () => {
    expect(
      targetSystemQualifierKey(system({ method: TargetSystemMethod.Manual, kind: undefined })),
    ).toBe("pamTargetSystemMethodManual");
  });

  it("states nothing about an integration this version cannot name", () => {
    expect(
      targetSystemQualifierKey(
        system({ method: TargetSystemMethod.Automatic, kind: TargetSystemKind.Unknown }),
      ),
    ).toBeNull();
  });

  it("states nothing about a method this version cannot model either", () => {
    expect(
      targetSystemQualifierKey(system({ method: TargetSystemMethod.Unknown, kind: undefined })),
    ).toBeNull();
  });
});

describe("targetSystemLabel", () => {
  it("tells two same-named targets apart by their integration", () => {
    const entra = targetSystemLabel(i18nFake, sysId("ts-1"), system());
    const script = targetSystemLabel(
      i18nFake,
      sysId("ts-2"),
      system({ id: sysId("ts-2"), kind: TargetSystemKind.CustomScript }),
    );

    expect(entra.name).toBe(script.name);
    expect(entra.qualified).not.toBe(script.qualified);
    expect(entra.qualified).toBe("dc01 AD domain accounts (pamTargetSystemKindEntra)");
    expect(script.qualified).toBe("dc01 AD domain accounts (pamTargetSystemKindCustomScript)");
  });

  it("leaves the name alone when there is no detail to add", () => {
    const label = targetSystemLabel(
      i18nFake,
      sysId("ts-1"),
      system({ method: TargetSystemMethod.Automatic, kind: TargetSystemKind.Unknown }),
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
