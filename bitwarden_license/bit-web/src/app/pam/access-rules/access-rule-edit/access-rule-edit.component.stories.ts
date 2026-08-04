import { importProvidersFrom } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import {
  applicationConfig,
  componentWrapperDecorator,
  Meta,
  moduleMetadata,
  StoryObj,
} from "@storybook/angular";
import { of } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { AccessRuleSdkService, AccessRuleView } from "../..";

import { AccessRuleEditComponent } from "./access-rule-edit.component";
import { CidrValidationService } from "./ip-allowlist/cidr-validation.service";

// The org's collections, as returned by the admin-console service; they populate the multi-select.
const ORG_COLLECTIONS = [
  { id: "col-1", name: "Engineering" },
  { id: "col-2", name: "Finance" },
  { id: "col-3", name: "Marketing" },
];

/** A fully-configured rule for the edit flow, exercising conditions, extensions, and duration caps. */
const SAMPLE_RULE = {
  id: "rule-1",
  organizationId: "org-1",
  name: "Production database access",
  description: "Elevated, audited access to the production database collections.",
  enabled: true,
  conditions: [{ kind: "human_approval" }, { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] }],
  singleActiveLease: true,
  defaultLeaseDurationSeconds: 60 * 60,
  maxLeaseDurationSeconds: 4 * 60 * 60,
  allowsExtensions: true,
  maxExtensionDurationSeconds: 60 * 60,
  collections: ["col-1", "col-3"],
  creationDate: "2024-01-01T00:00:00.000Z",
  revisionDate: "2024-01-02T00:00:00.000Z",
} as unknown as AccessRuleView;

const pamApi: Partial<AccessRuleSdkService> = {
  getAccessRule: () => Promise.resolve(SAMPLE_RULE),
  createAccessRule: () => Promise.resolve(SAMPLE_RULE),
  updateAccessRule: () => Promise.resolve(SAMPLE_RULE),
};

/** The routed page reads its mode from `route.snapshot`; vary it per story. */
function routeStub(
  params: Record<string, string> = {},
  queryParams: Record<string, string> = {},
): Partial<ActivatedRoute> {
  return {
    snapshot: {
      params: { organizationId: "org-1", ...params },
      queryParams,
    },
  } as unknown as ActivatedRoute;
}

export default {
  title: "Web/PAM/Access Rule Edit",
  component: AccessRuleEditComponent,
  decorators: [
    componentWrapperDecorator((story) => `<div class="tw-p-6">${story}</div>`),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        importProvidersFrom(RouterModule.forRoot([])),
        { provide: AccessRuleSdkService, useValue: pamApi },
        { provide: ToastService, useValue: { showToast: () => {} } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        {
          provide: CollectionAdminService,
          useValue: { collectionAdminViews$: () => of(ORG_COLLECTIONS) },
        },
        { provide: CidrValidationService, useValue: { isValid: () => true } },
        // Default to create mode; the Edit/Template stories override this.
        { provide: ActivatedRoute, useValue: routeStub() },
      ],
    }),
  ],
} as Meta<AccessRuleEditComponent>;

type Story = StoryObj<AccessRuleEditComponent>;

/** Create mode: an empty form with default durations. */
export const Create: Story = {};

/** Create mode seeded from the "approval required" starter template. */
export const CreateFromTemplate: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        { provide: ActivatedRoute, useValue: routeStub({}, { template: "approval-required" }) },
      ],
    }),
  ],
};

/** Edit mode: the form is populated from an existing rule (conditions + extensions enabled). */
export const Edit: Story = {
  decorators: [
    moduleMetadata({
      providers: [{ provide: ActivatedRoute, useValue: routeStub({ accessRuleId: "rule-1" }) }],
    }),
  ],
};
