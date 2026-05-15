import { FieldCluster, FieldUnit, SignalSnapshot } from "./internal";
import { Cue, CUES_BY_KIND, UNKNOWN_BASELINE_LOGIT } from "./likelihood-ratios";
import {
  ClassificationReason,
  ConfidenceBand,
  Distribution,
  FieldRole,
  RawDistribution,
} from "./types";

const DISTRIBUTION_EPSILON = 0.001;

// Roles the engine scores directly. UpdateCurrentPassword is the one shipped
// FieldRole the engine never emits in a Distribution — projection derives it
// from a CurrentPassword field's context.
type ScoredFieldRole = Exclude<FieldRole, "updateCurrentPassword">;

export type FieldClassificationResult = {
  readonly distribution: Distribution<FieldRole>;
  readonly reasons: ReadonlyArray<ClassificationReason>;
};

export function classifyFieldCluster(cluster: FieldCluster): FieldClassificationResult {
  return classifyUnit(cluster.members[0]);
}

function classifyUnit(unit: FieldUnit): FieldClassificationResult {
  const logits: Record<ScoredFieldRole | "unknown", number> = {
    username: 0,
    email: 0,
    currentPassword: 0,
    newPassword: 0,
    totp: 0,
    cardholderName: 0,
    cardNumber: 0,
    cardExpirationDate: 0,
    cardExpirationMonth: 0,
    cardExpirationYear: 0,
    cardCvv: 0,
    identityTitle: 0,
    identityFirstName: 0,
    identityMiddleName: 0,
    identityLastName: 0,
    identityFullName: 0,
    identityAddress1: 0,
    identityAddress2: 0,
    identityAddress3: 0,
    identityCity: 0,
    identityState: 0,
    identityPostalCode: 0,
    identityCountry: 0,
    identityCompany: 0,
    identityPhone: 0,
    identityEmail: 0,
    identityUsername: 0,
    unknown: UNKNOWN_BASELINE_LOGIT,
  };
  const reasons: ClassificationReason[] = [];

  for (const kind of Object.keys(CUES_BY_KIND) as ScoredFieldRole[]) {
    const cues = CUES_BY_KIND[kind];
    if (cues === undefined) {
      continue;
    }
    for (const cue of cues) {
      if (matchesCue(unit.signals, cue)) {
        logits[kind] += cue.weight;
        reasons.push({
          type: "field-cue",
          contributedTo: kind,
          fieldOpid: unit.source.opid,
          slot: cue.signal,
          matchedToken: cue.token,
          weight: cue.weight,
        });
      }
    }
  }

  const raw = softmax(logits) as RawDistribution<FieldRole>;
  return { distribution: withoutUnknown(raw), reasons };
}

function withoutUnknown<K extends string>(raw: RawDistribution<K>): Distribution<K> {
  const out: Partial<Record<K, number>> = {};
  for (const [k, v] of Object.entries(raw) as Array<[K | "unknown", number]>) {
    if (k === "unknown" || typeof v !== "number") {
      continue;
    }
    out[k] = v;
  }
  return out;
}

function matchesCue(signals: SignalSnapshot, cue: Cue): boolean {
  const t = signals.tight;
  switch (cue.signal) {
    case "autocomplete":
      return t.autocomplete.has(cue.token);
    case "type":
      return t.type === cue.token;
    case "inputmode":
      return t.inputMode === cue.token;
    case "idName":
      return t.idName.includes(normalizedCue(cue));
    case "placeholder":
      return t.placeholder.includes(normalizedCue(cue));
    case "label":
      return t.label.includes(normalizedCue(cue));
    case "dataset":
      return t.dataset.includes(normalizedCue(cue));
  }
}

function normalizedCue(cue: Cue): string {
  return cue.token.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function softmax<K extends string>(
  logits: Record<K, number>,
): Readonly<Partial<Record<K, number>>> {
  const entries = Object.entries(logits) as Array<[K, number]>;
  const max = entries.reduce((m, [, v]) => (v > m ? v : m), -Infinity);
  let sum = 0;
  const exps: Array<[K, number]> = entries.map(([k, v]) => {
    const e = Math.exp(v - max);
    sum += e;
    return [k, e];
  });
  const out: Partial<Record<K, number>> = {};
  for (const [k, e] of exps) {
    const p = e / sum;
    if (p > DISTRIBUTION_EPSILON) {
      out[k] = p;
    }
  }
  return out;
}

export function argmax<K extends string>(
  distribution: Distribution<K>,
): { kind: K | "unknown"; confidence: number } {
  let bestKey: K | "unknown" = "unknown";
  let bestVal = -Infinity;
  for (const [k, v] of Object.entries(distribution) as Array<[K | "unknown", number]>) {
    if (v > bestVal) {
      bestKey = k;
      bestVal = v;
    }
  }
  return { kind: bestKey, confidence: bestVal === -Infinity ? 0 : bestVal };
}

const CERTAIN = 1.0;
const HIGH = 0.55;
const LOW = 0.15;

export function bandFor(score: number): ConfidenceBand {
  if (score >= CERTAIN) {
    return "certain";
  }
  if (score >= HIGH) {
    return "high";
  }
  if (score >= LOW) {
    return "low";
  }
  return "none";
}
