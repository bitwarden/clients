import { RouterModule } from "@angular/router";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { AccessCondition, AccessRuleView, PamApiService } from "@bitwarden/bit-pam";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { I18nMockService } from "@bitwarden/components";

import { CollectionAccessRuleCalloutComponent } from "./collection-access-rule-callout.component";

const ORG_ID = "org-1";
const COLLECTION_ID = "col-1";

function rule(
  id: string,
  name: string,
  conditions: AccessCondition[],
  singleActiveLease = false,
): AccessRuleView {
  return {
    id,
    organizationId: ORG_ID,
    name,
    description: undefined,
    enabled: true,
    conditions,
    singleActiveLease,
    defaultLeaseDurationSeconds: undefined,
    maxLeaseDurationSeconds: undefined,
    allowsExtensions: false,
    maxExtensionDurationSeconds: undefined,
    collections: [COLLECTION_ID],
    creationDate: "2024-01-01T00:00:00.000Z",
    revisionDate: "2024-01-01T00:00:00.000Z",
  } as unknown as AccessRuleView;
}

/** A stub PamApiService that serves a fixed rule set, so the callout renders in isolation. */
const pamApiStub = (rules: AccessRuleView[]): Partial<PamApiService> => ({
  listAccessRules: () => Promise.resolve(rules),
});

export default {
  title: "Web/PAM/Collection Access Rule Callout",
  component: CollectionAccessRuleCalloutComponent,
  args: {
    organizationId: ORG_ID,
    collectionId: COLLECTION_ID,
  },
  decorators: [
    moduleMetadata({
      imports: [RouterModule.forRoot([])],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(true) } },
        { provide: LogService, useValue: { error: (): void => undefined } },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              pamCollectionAccessRuleCalloutTitle: "Access rule",
              pamCollectionAccessRuleCalloutBody: "Access to items here is controlled by",
              pamAccessRuleSummaryHumanApproval: "Approval",
              pamAccessRuleSummaryIpAllowlist: "IP restriction",
              pamAccessRuleSummarySingleActiveLease: "Single user access",
              pamAccessRuleSummaryNoConditions:
                "No conditions — anyone with collection access can lease.",
              close: "Close",
            }),
        },
      ],
    }),
  ],
} as Meta<CollectionAccessRuleCalloutComponent>;

type Story = StoryObj<CollectionAccessRuleCalloutComponent>;

export const Default: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: PamApiService,
          useValue: pamApiStub([
            rule("a", "Production secrets", [{ kind: "human_approval" }], true),
          ]),
        },
      ],
    }),
  ],
};

export const MultipleConditions: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: PamApiService,
          useValue: pamApiStub([
            rule("a", "Production secrets", [
              { kind: "human_approval" },
              { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] },
            ]),
          ]),
        },
      ],
    }),
  ],
};

export const FeatureFlagOff: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
        {
          provide: PamApiService,
          useValue: pamApiStub([rule("a", "Production secrets", [{ kind: "human_approval" }])]),
        },
      ],
    }),
  ],
};
