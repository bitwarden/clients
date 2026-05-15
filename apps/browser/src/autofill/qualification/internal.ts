import AutofillField from "../models/autofill-field";

import { ClassificationReason, Distribution, FieldRole, FormKind } from "./types";

export type TightSignals = {
  readonly autocomplete: ReadonlySet<string>;
  readonly type: string | null;
  readonly inputMode: string | null;
  readonly idName: string;
  readonly placeholder: string;
  readonly label: string;
  readonly dataset: string;
  readonly maxLength: number | null;
  readonly viewable: boolean;
};

export type AmbientSource = {
  readonly raw: string;
  readonly tokens: ReadonlySet<string>;
};

export type AmbientSignals = {
  readonly formAttrs: ReadonlyArray<AmbientSource>;
  readonly submitButtonText: ReadonlyArray<AmbientSource>;
  readonly headings: ReadonlyArray<AmbientSource>;
  readonly pageTitle: AmbientSource | null;
  readonly urlPath: AmbientSource | null;
};

export type SignalSnapshot = {
  readonly opid: string;
  readonly tight: TightSignals;
  readonly ambient: AmbientSignals;
};

export type FieldUnit = {
  readonly source: AutofillField;
  readonly signals: SignalSnapshot;
};

export type ClusterShape =
  | { readonly variant: "split-by-position"; readonly total: number }
  | { readonly variant: "split-by-role"; readonly roles: ReadonlyMap<string, FieldRole> };

export type FieldCluster = {
  readonly id: string;
  readonly members: ReadonlyArray<FieldUnit>;
  readonly shape: ClusterShape | null;
};

export type ClassifiedField = {
  readonly cluster: FieldCluster;
  readonly distribution: Distribution<FieldRole>;
  readonly reasons: ReadonlyArray<ClassificationReason>;
};

export type FormScope =
  | { readonly kind: "form-element"; readonly opids: ReadonlyArray<string> }
  | { readonly kind: "form-less" };

export type FormClusterUnit = {
  readonly scope: FormScope;
  readonly members: ReadonlyArray<ClassifiedField>;
  readonly ambient: AmbientSignals;
};

export type ClassifiedFormCluster = {
  readonly cluster: FormClusterUnit;
  readonly distribution: Distribution<FormKind>;
  readonly reasons: ReadonlyArray<ClassificationReason>;
};
