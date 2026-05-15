import { ClassifiedField, FieldCluster, FieldUnit, FormClusterUnit } from "./internal";

export function clusterFieldsBySplitForms(units: ReadonlyArray<FieldUnit>): FieldCluster[] {
  const consumed = new Set<string>();
  const out: FieldCluster[] = [];

  for (let i = 0; i < units.length; i++) {
    const head = units[i];
    if (consumed.has(head.source.opid)) {
      continue;
    }

    const otp = tryExtendOtpCluster(units, i, consumed);
    if (otp) {
      out.push(otp);
      continue;
    }

    consumed.add(head.source.opid);
    out.push({
      id: head.source.opid,
      members: [head],
      shape: null,
    });
  }
  return out;
}

function tryExtendOtpCluster(
  units: ReadonlyArray<FieldUnit>,
  startIndex: number,
  consumed: Set<string>,
): FieldCluster | null {
  const head = units[startIndex];
  if (!looksLikeOtpDigit(head)) {
    return null;
  }
  const members: FieldUnit[] = [head];
  for (let j = startIndex + 1; j < units.length; j++) {
    const next = units[j];
    if (consumed.has(next.source.opid)) {
      break;
    }
    if (!looksLikeOtpDigit(next)) {
      break;
    }
    if (!adjacentByElementNumber(members[members.length - 1], next)) {
      break;
    }
    if (!sameForm(head, next)) {
      break;
    }
    members.push(next);
  }
  if (members.length < OTP_MIN_MEMBERS) {
    return null;
  }
  for (const m of members) {
    consumed.add(m.source.opid);
  }
  return {
    id: members[0].source.opid,
    members,
    shape: { variant: "split-by-position", total: members.length },
  };
}

const OTP_MIN_MEMBERS = 4;
const OTP_MAX_ELEMENT_NUMBER_GAP = 3;

function looksLikeOtpDigit(unit: FieldUnit): boolean {
  const tight = unit.signals.tight;
  const isCharBox = tight.maxLength === 1;
  const declared = tight.autocomplete.has("one-time-code");
  const looksNumeric =
    tight.type === "text" || tight.type === "tel" || tight.type === "number" || tight.type === null;
  return declared || (isCharBox && looksNumeric);
}

function adjacentByElementNumber(prev: FieldUnit, next: FieldUnit): boolean {
  const gap = next.source.elementNumber - prev.source.elementNumber;
  return gap > 0 && gap <= OTP_MAX_ELEMENT_NUMBER_GAP;
}

function sameForm(a: FieldUnit, b: FieldUnit): boolean {
  return (a.source.form ?? null) === (b.source.form ?? null);
}

export function clusterByForm(classified: ReadonlyArray<ClassifiedField>): FormClusterUnit[] {
  const byOpid = new Map<string, ClassifiedField[]>();
  const formLess: ClassifiedField[] = [];

  for (const cf of classified) {
    const opid = cf.cluster.members[0].source.form ?? null;
    if (opid == null) {
      formLess.push(cf);
      continue;
    }
    const bucket = byOpid.get(opid) ?? [];
    bucket.push(cf);
    byOpid.set(opid, bucket);
  }

  const result: FormClusterUnit[] = [];
  for (const [opid, members] of byOpid) {
    result.push({
      scope: { kind: "form-element", opids: [opid] },
      members,
      ambient: members[0].cluster.members[0].signals.ambient,
    });
  }
  if (formLess.length > 0) {
    result.push({
      scope: { kind: "form-less" },
      members: formLess,
      ambient: formLess[0].cluster.members[0].signals.ambient,
    });
  }
  return result;
}
