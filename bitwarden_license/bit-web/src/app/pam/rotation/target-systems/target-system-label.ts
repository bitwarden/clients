import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { TargetSystem, TargetSystemId, TargetSystemKind, TargetSystemMethod } from "../rotation";

/** A target system as a list row, a picker option, or a control's accessible name names it. */
export type TargetSystemLabel = {
  id: TargetSystemId;
  /** Not unique; two systems can share one. */
  name: string;
  /** i18n key for the qualifying detail, or null when there is none to state. */
  qualifierKey: string | null;
  /** {@link name} plus that detail, falling back to the name alone when there is none. */
  qualified: string;
};

const KIND_LABEL_KEYS: Record<TargetSystemKind, string | null> = {
  [TargetSystemKind.Entra]: "pamTargetSystemTypeEntra",
  [TargetSystemKind.Mssql]: null,
  [TargetSystemKind.CustomScript]: "pamTargetSystemTypeCustomScript",
  [TargetSystemKind.Unknown]: null,
};

const METHOD_LABEL_KEYS: Record<TargetSystemMethod, string | null> = {
  [TargetSystemMethod.Automatic]: "pamTargetSystemMethodAutomatic",
  [TargetSystemMethod.Manual]: "pamTargetSystemMethodManual",
  [TargetSystemMethod.Unknown]: null,
};

/**
 * The i18n key naming a target system's integration. Null for a manual target, for `mssql`, which
 * this client does not offer, and for a kind this SDK cannot model.
 */
export function targetSystemKindLabelKey(kind: TargetSystemKind | undefined | null): string | null {
  return kind == null ? null : (KIND_LABEL_KEYS[kind] ?? null);
}

/** The i18n key for a target system's rotation method, or null for one this SDK can't model. */
export function targetSystemMethodLabelKey(method: TargetSystemMethod): string | null {
  return METHOD_LABEL_KEYS[method] ?? null;
}

/**
 * The i18n key for the detail that tells a target system from a same-named sibling of another kind
 * or method. Siblings sharing both still match, so key off {@link TargetSystemLabel.id} for
 * uniqueness.
 */
export function targetSystemQualifierKey(
  system: Pick<TargetSystem, "kind" | "method">,
): string | null {
  return system.kind == null
    ? targetSystemMethodLabelKey(system.method)
    : targetSystemKindLabelKey(system.kind);
}

/** Falls back to the raw id while the system is unknown. */
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
