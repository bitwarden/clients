import { Injectable, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router, NavigationEnd } from "@angular/router";
import { filter } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";

export interface ManagedCredentialDraft {
  readonly organizationId: OrganizationId;
  readonly cipherId: string;
  readonly targetSystemId: string;
  readonly accountIdentity: string;
  readonly scheduleCron: string | null;
  readonly rotateOnAccessEnd: boolean;
  readonly terminateSessions: boolean;
}

const FLOW_PATH = /\/pam\/rotation\/(target-systems|managed-credentials)\/new(\?|$)/;

/**
 * Holds the add-managed-credential form in memory while the admin creates a target system from it.
 * The draft is read once, and dropped as soon as navigation leaves the two create pages.
 */
@Injectable({ providedIn: "root" })
export class ManagedCredentialDraftService {
  private draft: ManagedCredentialDraft | null = null;

  constructor() {
    const router = inject(Router, { optional: true });
    router?.events
      ?.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        if (!FLOW_PATH.test(event.urlAfterRedirects)) {
          this.draft = null;
        }
      });
  }

  save(draft: ManagedCredentialDraft): void {
    this.draft = draft;
  }

  take(organizationId: OrganizationId): ManagedCredentialDraft | null {
    const draft = this.draft;
    this.draft = null;
    return draft?.organizationId === organizationId ? draft : null;
  }
}
