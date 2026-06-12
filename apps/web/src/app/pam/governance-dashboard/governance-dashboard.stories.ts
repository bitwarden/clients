import { importProvidersFrom } from "@angular/core";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";
import {
  CollectionGovernanceRowResponse,
  OrganizationGovernanceSummaryResponse,
  PamApiService,
} from "@bitwarden/pam";

import { PreloadedEnglishI18nModule } from "../../core/tests";

import { GovernanceDashboardComponent } from "./governance-dashboard.component";

/**
 * Storybook stories for the PAM credential-leasing governance dashboard
 * (PM-37277). Covers requirement N6 visual states.
 */
class StubPamApiService {
  /** Never resolves — the override input drives the rendered state. */
  getGovernanceSummary(): Promise<OrganizationGovernanceSummaryResponse> {
    return new Promise(() => undefined);
  }
}

class StubOrganizationService {
  organizations$(_userId: unknown) {
    return of([{ id: "org-1", name: "Acme Corp" }]);
  }
}

class StubAccountService {
  activeAccount$ = of({ id: "user-1" });
}

class StubConfigService {
  getFeatureFlag$(_flag: unknown) {
    return of(false);
  }
}

function makeRow(opts: {
  id: string;
  name: string;
  conditions?: unknown[];
  memberWithAccess?: number;
  pending?: number;
  active?: number;
  lastActivity?: string | null;
}): CollectionGovernanceRowResponse {
  return new CollectionGovernanceRowResponse({
    CollectionId: opts.id,
    CollectionName: opts.name,
    Conditions: opts.conditions ?? [],
    MemberWithAccessCount: opts.memberWithAccess ?? 0,
    PendingRequestCount: opts.pending ?? 0,
    ActiveLeaseCount: opts.active ?? 0,
    LastActivityAt: opts.lastActivity ?? null,
  });
}

function makeSummary(
  rows: CollectionGovernanceRowResponse[],
): OrganizationGovernanceSummaryResponse {
  const summary = new OrganizationGovernanceSummaryResponse({
    OrganizationId: "org-1",
    Collections: [],
  });
  summary.leasingEnabledCollectionCount = rows.length;
  summary.totalPendingRequestCount = rows.reduce((sum, r) => sum + r.pendingRequestCount, 0);
  summary.totalActiveLeaseCount = rows.reduce((sum, r) => sum + r.activeLeaseCount, 0);
  summary.collections = rows;
  return summary;
}

export default {
  title: "Web/Admin Console/PAM/Governance Dashboard",
  component: GovernanceDashboardComponent,
  decorators: [
    moduleMetadata({
      imports: [GovernanceDashboardComponent, RouterTestingModule],
      providers: [
        { provide: PamApiService, useClass: StubPamApiService },
        { provide: OrganizationService, useClass: StubOrganizationService },
        { provide: AccountService, useClass: StubAccountService },
        { provide: ConfigService, useClass: StubConfigService },
        { provide: LogService, useValue: { error: () => {} } },
        { provide: DialogService, useValue: { open: () => ({ closed: of(undefined) }) } },
        { provide: ToastService, useValue: { showToast: () => {} } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ organizationId: "org-1" }) },
          },
        },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta<GovernanceDashboardComponent>;

type Story = StoryObj<GovernanceDashboardComponent>;

const emptyRows: CollectionGovernanceRowResponse[] = [];

const smallRows = [
  makeRow({
    id: "col-prod-db",
    name: "Production Databases",
    conditions: [{ Kind: "human_approval" }],
    memberWithAccess: 8,
    pending: 2,
    active: 3,
    lastActivity: "2026-05-14T19:22:00Z",
  }),
  makeRow({
    id: "col-prod-api",
    name: "Production API Keys",
    conditions: [
      { Kind: "human_approval" },
      { Kind: "ip_allowlist", Cidrs: ["10.0.0.0/8", "192.168.0.0/16", "172.16.0.0/12"] },
    ],
    memberWithAccess: 4,
    pending: 0,
    active: 1,
    lastActivity: "2026-05-13T08:00:00Z",
  }),
  makeRow({
    id: "col-infra",
    name: "Infrastructure SSH",
    conditions: [{ Kind: "ip_allowlist", Cidrs: ["10.0.0.0/8"] }],
    memberWithAccess: 12,
    pending: 0,
    active: 0,
    lastActivity: null,
  }),
];

const busyRows = Array.from({ length: 12 }, (_, i) =>
  makeRow({
    id: `col-${i}`,
    name: `Collection ${i + 1}`,
    conditions: i % 3 === 0 ? [{ Kind: "human_approval" }] : [],
    memberWithAccess: (i * 3) % 20,
    pending: i % 4,
    active: (i + 1) % 5,
    lastActivity: i % 5 === 0 ? null : `2026-05-${(i % 28) + 1}T12:00:00Z`,
  }),
);

/** N6: org-admin opens governance dashboard when no leasing-enabled collections exist. */
export const EmptyOrganization: Story = {
  args: {
    summaryOverride: makeSummary(emptyRows),
  },
};

/** N6: small org with 3 leasing-enabled collections exercising every access-rule kind. */
export const SmallOrganization: Story = {
  args: {
    summaryOverride: makeSummary(smallRows),
  },
};

/** N6: busy org with many rows to validate table layout. */
export const BusyOrganization: Story = {
  args: {
    summaryOverride: makeSummary(busyRows),
  },
};
