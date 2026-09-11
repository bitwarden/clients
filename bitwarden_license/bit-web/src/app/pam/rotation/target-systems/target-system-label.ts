import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { TargetSystem, TargetSystemId, TargetSystemKind, TargetSystemMethod } from "../rotation";

/** A target system as a list row, a picker option, or a control's accessible name names it. */
export type TargetSystemLabel = {
  id: TargetSystemId;
  /** The system's own name. Two systems can share one. */
  name: string;
  /** i18n key for the qualifying detail, or null when there is none to state. */
  qualifierKey: string | null;
  /** {@link name} plus that detail, falling back to the name alone when there is none. */
  qualified: string;
};

const KIND_LABEL_KEYS: Record<TargetSystemKind, string | null> = {
  [TargetSystemKind.Entra]: "pamTargetSystemKindEntra",
  [TargetSystemKind.Mssql]: "pamTargetSystemKindMssql",
  [TargetSystemKind.CustomScript]: "pamTargetSystemKindCustomScript",
  [TargetSystemKind.Unknown]: null,
};

const METHOD_LABEL_KEYS: Record<TargetSystemMethod, string | null> = {
  [TargetSystemMethod.Automatic]: "pamTargetSystemMethodAutomatic",
  [TargetSystemMethod.Manual]: "pamTargetSystemMethodManual",
  [TargetSystemMethod.Unknown]: null,
};

/**
 * The i18n key naming the integration behind a target system. Null for a manual target, which has
 * no integration, and for a kind a newer server named that this SDK version cannot model.
 */
export function targetSystemKindLabelKey(kind: TargetSystemKind | undefined | null): string | null {
  return kind == null ? null : (KIND_LABEL_KEYS[kind] ?? null);
}

/** The i18n key naming how a target system rotates, or null for a method this version cannot model. */
export function targetSystemMethodLabelKey(method: TargetSystemMethod): string | null {
  return METHOD_LABEL_KEYS[method] ?? null;
}

/** The i18n key for the detail that distinguishes a target system from a same-named sibling. */
export function targetSystemQualifierKey(
  system: Pick<TargetSystem, "kind" | "method">,
): string | null {
  return system.kind == null
    ? targetSystemMethodLabelKey(system.method)
    : targetSystemKindLabelKey(system.kind);
}

/** Name a target system for display. */
export function targetSystemLabel(
  i18nService: I18nService,
  id: TargetSystemId,
  system: TargetSystem | undefined,
): TargetSystemLabel {
  if (system == null) {
    const fallback = String(id);
    return { id, name: fallback, qualifierKey: null, qualified: fallback };
  }

  const qualifierKey = targetSystemQualifierKey(system);
  return {
    id,
    name: system.name,
    qualifierKey,
    qualified:
      qualifierKey == null
        ? system.name
        : i18nService.t("pamTargetSystemNameWithDetail", system.name, i18nService.t(qualifierKey)),
  };
}
