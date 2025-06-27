import { combineLatest, map, Observable, of } from "rxjs";

import { BasePolicy } from "../organizations/policies";

export class PolicyListService {
  private policies$: Observable<BasePolicy[]> = of([]);

  addPolicies(policies: Observable<BasePolicy[]>) {
    this.policies$ = combineLatest([this.policies$, policies]).pipe(
      map(([policies, newPolicies]) => this.upsert(newPolicies, policies)),
    );
  }

  getPolicies(): Observable<BasePolicy[]> {
    return this.policies$;
  }

  private upsert(p1: BasePolicy[], p2: BasePolicy[]) {
    for (const policy of p1) {
      const existingIndex = p2.findIndex((p) => p.type == policy.type);
      if (p2[existingIndex]) {
        p2[existingIndex] = policy;
        continue;
      }
      p2.push(policy);
    }
    return p2;
  }
}
