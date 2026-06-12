import { RouterModule } from "@angular/router";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { I18nMockService } from "@bitwarden/components";
import { AccessCondition, AccessRuleResponse, PamApiService } from "@bitwarden/pam";

import { CollectionAccessRuleCalloutComponent } from "./collection-access-rule-callout.component";

const ORG_ID = "org-1";
const COLLECTION_ID = "col-1";

function rule(
  id: string,
  name: string,
  conditions: AccessCondition[],
  singleActiveLease = false,
): AccessRuleResponse {
  return new AccessRuleResponse({
    Id: id,
    Name: name,
    Enabled: true,
    Collections: [COLLECTION_ID],
    Conditions: conditions,
    SingleActiveLease: singleActiveLease,
  });
}

/** A stub PamApiService that serves a fixed rule set, so the callout renders in isolation. */
const pamApiStub = (rules: AccessRuleResponse[]): Partial<PamApiService> => ({
  listAccessRules: () => Promise.resolve({ data: rules } as never),
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
        { provide: LogService, useValue: { error: () => undefined } },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              pamCollectionAccessRuleCalloutTitle: "Access rule active",
              pamCollectionAccessRuleCalloutBody:
                "Access to items in this collection is controlled by:",
              pamCollectionAccessRuleManageLink: "Manage access rules",
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

export const SingleRule: Story = {
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

export const MultipleRules: Story = {
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
            rule("b", "Break-glass access", []),
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
