import { importProvidersFrom } from "@angular/core";
import { provideAnimations } from "@angular/platform-browser/animations";
import { ActivatedRoute, RouterModule } from "@angular/router";
import {
  applicationConfig,
  componentWrapperDecorator,
  Meta,
  moduleMetadata,
  StoryObj,
} from "@storybook/angular";
import { of } from "rxjs";
import { getByText, userEvent } from "storybook/test";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DialogModule, DialogService, ToastService } from "@bitwarden/components";
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
        {
          provide: OrganizationService,
          useValue: { organizations$: () => of([{ id: "org-1", canAccessEventLogs: true }]) },
        },
        { provide: DialogService, useValue: { openSimpleDialog: () => Promise.resolve(false) } },
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

/**
 * The save-failure callout. Edit mode, with the update rejected: the form arrives valid and
 * populated, so pressing Save goes straight to the failure rather than to validation.
 */
export const SaveError: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        { provide: ActivatedRoute, useValue: routeStub({ accessRuleId: "rule-1" }) },
        {
          provide: AccessRuleSdkService,
          useValue: {
            ...pamApi,
            updateAccessRule: () =>
              Promise.reject(new Error("The access rule service is unavailable.")),
          } satisfies Partial<AccessRuleSdkService>,
        },
      ],
    }),
  ],
  play: async (context) => {
    await userEvent.click(getByText(context.canvasElement, "Save"));
  },
};

/**
 * The validation summary above the action row: submitting the empty create form, where
 * name and collections are both required.
 */
export const ValidationSummary: Story = {
  play: async (context) => {
    await userEvent.click(getByText(context.canvasElement, "Save"));
  },
};

/**
 * The discard confirmation. Typing into the name dirties the form, so Cancel asks before
 * leaving. `DialogModule` supplies the real {@link DialogService} in place of the default
 * stub, so the dialog itself renders — it is what this story is for.
 */
export const DiscardConfirmation: Story = {
  decorators: [
    applicationConfig({ providers: [provideAnimations()] }),
    moduleMetadata({ imports: [DialogModule] }),
  ],
  play: async (context) => {
    const canvas = context.canvasElement;
    const name = canvas.querySelector("#access-rule-edit_input_name") as HTMLInputElement;

    await userEvent.type(name, "Half-finished rule");
    await userEvent.click(getByText(canvas, "Cancel"));
  },
};
