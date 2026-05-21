import { Injectable } from "@angular/core";

import { CollectionMembershipForLeasing, LeaseResponse } from "@bitwarden/pam";

import { PamMockConfig } from "./pam-mock-config";
import { PamMockStore } from "./pam-mock-store";

/**
 * DEMO ONLY — supplies the `memberships` and `activeLeases` inputs that
 * `CipherOpenInterceptorService.open()` would otherwise get from the (not yet
 * wired) collection-membership and active-lease data sources.
 *
 * When the mock is disabled this returns empty arrays so production behaviour
 * is byte-identical with the existing hard-coded `[]` placeholders.
 */
@Injectable({ providedIn: "root" })
export class MockCipherMembershipService {
  constructor(private readonly store: PamMockStore) {}

  forCipher(
    cipherId: string,
    userId: string,
  ): { memberships: CollectionMembershipForLeasing[]; activeLeases: LeaseResponse[] } {
    if (!PamMockConfig.isEnabled() || !PamMockConfig.shouldGate(cipherId)) {
      return { memberships: [], activeLeases: [] };
    }
    this.store.ensureSeedLease(cipherId, userId);
    const lease = this.store.leasesByCipher.get(cipherId);
    return {
      memberships: [{ requireLease: true }],
      activeLeases: lease ? [lease] : [],
    };
  }
}
