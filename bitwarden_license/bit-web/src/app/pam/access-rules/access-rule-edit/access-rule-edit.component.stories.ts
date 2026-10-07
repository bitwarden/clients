import { importProvidersFrom } from "@angular/core";
import { provideAnimations } from "@angular/platform-browser/animations";
import { provideRouter, RouterOutlet, Routes, withHashLocation } from "@angular/router";
import {
  applicationConfig,
  componentWrapperDecorator,
  Decorator,
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
import { GovernedCollectionsService } from "../../services/governed-collections.service";

import { AccessRuleEditComponent } from "./access-rule-edit.component";
import { CidrValidationService } from "./ip-allowlist/cidr-validation.service";

const ORG_COLLECTIONS = [
  { id: "col-1", name: "Engineering" },
  { id: "col-2", name: "Finance" },
  { id: "col-3", name: "Marketing" },
];

/** Exercises conditions, extensions and duration caps. */
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

/**
 * Mirrors `pam-routing.module.ts` without its guards, since a stubbed `ActivatedRoute` can't
 * resolve the `['..']` breadcrumb and renders it as the active page.
 */
const routes: Routes = [
  {
    path: "organizations/:organizationId/access-rules",
    children: [
      { path: "", children: [] },
      // List "new" before ":accessRuleId" so the literal path wins.
      { path: "new", component: AccessRuleEditComponent },
      { path: ":accessRuleId", component: AccessRuleEditComponent },
    ],
  },
];

/** A minimal rule; only the collections it claims matter. */
const governingRule = (name: string, enabled: boolean, collections: string[]) =>
  ({
    id: `rule-${name}`,
    name,
    enabled,
    collections,
    conditions: [],
    singleActiveLease: false,
  }) as unknown as AccessRuleView;

/** Drives the picker's governed-collection filter. */
const governedBy = (rules: AccessRuleView[]): Decorator =>
  moduleMetadata({
    providers: [
      {
        provide: GovernedCollectionsService,
        useValue: { rules$: () => of(rules), invalidate: () => {} },
      },
    ],
  });

/** Renders the story at `url`; hash routing keeps Storybook's own query string intact. */
const atUrl =
  (url: string): Decorator =>
  (storyFn, context) => {
    window.location.hash = url;
    return storyFn(context);
  };

export default {
  title: "Web/PAM/Access Rule Edit",
  component: AccessRuleEditComponent,
  render: () => ({ template: `<router-outlet></router-outlet>` }),
  decorators: [
    componentWrapperDecorator((story) => `<div class="tw-p-6">${story}</div>`),
    moduleMetadata({ imports: [RouterOutlet] }),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideRouter(routes, withHashLocation()),
        { provide: AccessRuleSdkService, useValue: pamApi },
        { provide: ToastService, useValue: { showToast: () => {} } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        {
          provide: CollectionAdminService,
          useValue: { collectionAdminViews$: () => of(ORG_COLLECTIONS) },
        },
        {
          provide: GovernedCollectionsService,
          useValue: { rules$: () => of([]), invalidate: () => {} },
        },
        { provide: CidrValidationService, useValue: { isValid: () => true } },
        {
          provide: OrganizationService,
          useValue: { organizations$: () => of([{ id: "org-1", canAccessEventLogs: true }]) },
        },
        { provide: DialogService, useValue: { openSimpleDialog: () => Promise.resolve(false) } },
      ],
    }),
  ],
} as Meta<AccessRuleEditComponent>;

type Story = StoryObj<AccessRuleEditComponent>;

export const Create: Story = {
  decorators: [atUrl("/organizations/org-1/access-rules/new")],
};

/** Create mode seeded from the "approval required" starter template. */
export const CreateFromTemplate: Story = {
  decorators: [atUrl("/organizations/org-1/access-rules/new?template=approval-required")],
};

/** Only `col-2` is offered; `col-1`'s rule is disabled but still counts, as on the server. */
export const CreateWithGovernedCollections: Story = {
  decorators: [
    atUrl("/organizations/org-1/access-rules/new"),
    governedBy([
      governingRule("Disabled rule", false, ["col-1"]),
      governingRule("Enabled rule", true, ["col-3"]),
    ]),
  ],
};

/** `rule-1` governs its own collections, which stay selectable. */
export const Edit: Story = {
  decorators: [atUrl("/organizations/org-1/access-rules/rule-1"), governedBy([SAMPLE_RULE])],
};

/** The header badge reads "Off" and the Status checkbox is clear. */
export const EditInactive: Story = {
  decorators: [
    atUrl("/organizations/org-1/access-rules/rule-1"),
    moduleMetadata({
      providers: [
        {
          provide: AccessRuleSdkService,
          useValue: {
            ...pamApi,
            getAccessRule: () => Promise.resolve({ ...SAMPLE_RULE, enabled: false }),
          } satisfies Partial<AccessRuleSdkService>,
        },
      ],
    }),
  ],
};

/** Edit mode, so the form is already valid and Save goes straight to the failure callout. */
export const SaveError: Story = {
  decorators: [
    atUrl("/organizations/org-1/access-rules/rule-1"),
    moduleMetadata({
      providers: [
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
 * A recognised rejection shows on the field it names, without a retry, since resending the same
 * collections would fail the same way.
 */
export const SaveErrorOnField: Story = {
  decorators: [
    atUrl("/organizations/org-1/access-rules/rule-1"),
    moduleMetadata({
      providers: [
        {
          provide: AccessRuleSdkService,
          useValue: {
            ...pamApi,
            updateAccessRule: () =>
              Promise.reject(
                Object.assign(
                  new Error("One or more collections are already governed by another access rule."),
                  { name: "AccessRuleError", variant: "Api" },
                ),
              ),
          } satisfies Partial<AccessRuleSdkService>,
        },
      ],
    }),
  ],
  play: async (context) => {
    await userEvent.click(getByText(context.canvasElement, "Save"));
  },
};

/** Submits the empty create form, where name and collections are required. */
export const ValidationSummary: Story = {
  play: async (context) => {
    await userEvent.click(getByText(context.canvasElement, "Save"));
  },
};

/**
 * Typing dirties the form, so Cancel asks first. `DialogModule` replaces the default
 * {@link DialogService} stub so the dialog renders.
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
