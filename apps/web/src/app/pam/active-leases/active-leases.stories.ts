import { CommonModule } from "@angular/common";
import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { BehaviorSubject } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ToastService } from "@bitwarden/components";
import { LeaseResponse, LeaseRevokeRequest, PamApiService } from "@bitwarden/pam";

import { PreloadedEnglishI18nModule } from "../../core/tests";

import { ActiveLeasesComponent } from "./active-leases.component";

function lease(overrides: Record<string, unknown>): LeaseResponse {
  return new LeaseResponse({
    Id: "lease-x",
    RequestId: "req-x",
    CipherId: "cipher-x",
    CollectionId: "col-x",
    GranteeUserId: "user-x",
    NotBefore: "2026-01-01T00:00:00Z",
    NotAfter: "2026-01-01T01:00:00Z",
    Status: "active",
    ...overrides,
  });
}

const now = () => new Date();

const single: LeaseResponse[] = [
  lease({
    Id: "lease-1",
    CipherId: "Production DB root",
    CollectionId: "Production Secrets",
    GranteeUserId: "alex@example.com",
    NotBefore: new Date(now().getTime() - 30_000).toISOString(),
    NotAfter: new Date(now().getTime() + 15_000).toISOString(),
  }),
];

const several: LeaseResponse[] = [
  lease({
    Id: "lease-1",
    CipherId: "Production DB root",
    CollectionId: "Production Secrets",
    GranteeUserId: "alex@example.com",
    NotBefore: new Date(now().getTime() - 60_000).toISOString(),
    NotAfter: new Date(now().getTime() + 47 * 60_000).toISOString(),
  }),
  lease({
    Id: "lease-2",
    CipherId: "Staging deploy key",
    CollectionId: "Staging Secrets",
    GranteeUserId: "jordan@example.com",
    NotBefore: new Date(now().getTime() - 120_000).toISOString(),
    NotAfter: new Date(now().getTime() + (2 * 3600 + 5 * 60) * 1000).toISOString(),
  }),
  lease({
    Id: "lease-3",
    CipherId: "Pager rotation key",
    CollectionId: "On-call Tooling",
    GranteeUserId: "sam@example.com",
    NotBefore: new Date(now().getTime() - 90_000).toISOString(),
    NotAfter: new Date(now().getTime() + 25_000).toISOString(),
  }),
];

class StaticPamApiService implements Partial<PamApiService> {
  constructor(private readonly leases: LeaseResponse[]) {}

  listActiveLeases = (): Promise<LeaseResponse[]> => Promise.resolve(this.leases);

  revokeLease = (_id: string, _request: LeaseRevokeRequest): Promise<void> => Promise.resolve();
}

class ConfigServiceStub implements Partial<ConfigService> {
  getFeatureFlag$ = () => new BehaviorSubject(true);
}

class ToastServiceStub implements Partial<ToastService> {
  showToast = () => undefined;
}

class LogServiceStub implements Partial<LogService> {
  // eslint-disable-next-line no-console
  error = (...args: unknown[]) => console.error(...args);
   
  warning = () => {};
   
  info = () => {};
   
  debug = () => {};
}

function providersFor(leases: LeaseResponse[]) {
  return [
    { provide: PamApiService, useValue: new StaticPamApiService(leases) },
    { provide: ConfigService, useClass: ConfigServiceStub },
    { provide: ToastService, useClass: ToastServiceStub },
    { provide: LogService, useClass: LogServiceStub },
  ];
}

export default {
  title: "Web/PAM/Active Leases",
  component: ActiveLeasesComponent,
  decorators: [
    moduleMetadata({
      imports: [CommonModule, ActiveLeasesComponent],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta<ActiveLeasesComponent>;

type Story = StoryObj<ActiveLeasesComponent>;

export const Empty: Story = {
  decorators: [
    moduleMetadata({
      providers: providersFor([]),
    }),
  ],
  render: () => ({ template: `<app-pam-active-leases></app-pam-active-leases>` }),
};

export const SingleLeaseSecondsRemaining: Story = {
  decorators: [
    moduleMetadata({
      providers: providersFor(single),
    }),
  ],
  render: () => ({ template: `<app-pam-active-leases></app-pam-active-leases>` }),
};

export const SeveralMixed: Story = {
  decorators: [
    moduleMetadata({
      providers: providersFor(several),
    }),
  ],
  render: () => ({ template: `<app-pam-active-leases></app-pam-active-leases>` }),
};

/**
 * Demonstrates the post-revoke transient state. The story-only PamApi
 * stub resolves `revokeLease` immediately, so clicking Revoke flips the
 * row to the "Revoked" badge briefly before it disappears.
 */
export const PostRevokeTransient: Story = {
  decorators: [
    moduleMetadata({
      providers: providersFor(single),
    }),
  ],
  render: () => ({
    template: `<app-pam-active-leases></app-pam-active-leases>`,
  }),
};
