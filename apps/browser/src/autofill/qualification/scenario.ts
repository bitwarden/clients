import { argmax, bandFor } from "./classification";
import { ClassifiedFormCluster } from "./internal";
import { FormKind, PageScenario, PageScenarioKind } from "./types";
import { toPageScenario } from "./vocabulary";

type Candidate = {
  readonly cluster: ClassifiedFormCluster;
  readonly kind: FormKind;
  readonly confidence: number;
};

export function synthesizeScenario(
  clusters: ReadonlyArray<ClassifiedFormCluster>,
): PageScenario | null {
  if (clusters.length === 0) {
    return null;
  }

  const aboveFloor = clusters
    .map((c) => {
      const { kind, confidence } = argmax(c.distribution);
      return { cluster: c, kind, confidence };
    })
    .filter((w): w is Candidate => w.kind !== "unknown" && bandFor(w.confidence) !== "none");

  if (aboveFloor.length === 0) {
    return null;
  }

  const distinctKinds = new Set(aboveFloor.map((w) => w.kind));
  if (distinctKinds.size > 1) {
    return null;
  }

  const dominant = aboveFloor.reduce((best, current) =>
    current.confidence > best.confidence ? current : best,
  );

  const scenarioKind = internalScenarioFor(dominant.kind);
  if (scenarioKind === "unknown") {
    return null;
  }
  return toPageScenario(scenarioKind);
}

function internalScenarioFor(kind: FormKind): PageScenarioKind | "unknown" {
  switch (kind) {
    case "account-login":
      return "login-page";
    case "account-creation":
      return "signup-page";
    case "account-update":
      return "update-page";
    case "account-recovery":
    case "account-username-recovery":
      return "recovery-page";
    case "payment-card":
      return "checkout-page";
    case "identity":
      return "profile-page";
    case "signup":
      return "unknown";
  }
}
