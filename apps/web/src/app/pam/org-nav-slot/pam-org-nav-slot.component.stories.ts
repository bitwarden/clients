import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService, NavigationModule } from "@bitwarden/components";

import { PamOrgNavSlotComponent } from "./pam-org-nav-slot.component";

function organization(canManageAccessRules: boolean, canAccessEventLogs: boolean): Organization {
  return { canManageAccessRules, canAccessEventLogs } as Organization;
}

function nav(options: { rotationEnabled?: boolean } = {}) {
  const { rotationEnabled = false } = options;
  return moduleMetadata({
    imports: [PamOrgNavSlotComponent, NavigationModule],
    providers: [
      {
        provide: ConfigService,
        useValue: {
          getFeatureFlag$: (flag: FeatureFlag) =>
            of(flag === FeatureFlag.PamRotation ? rotationEnabled : true),
        },
      },
      {
        provide: I18nService,
        useFactory: () =>
          new I18nMockService({
            privilegedControls: "Privileged Controls",
            pamAccessRules: "Access rules",
            pamAuditLog: "Audit log",
            pamRotationNav: "Rotation",
          }),
      },
    ],
  });
}

export default {
  title: "Web/PAM/Org Nav Slot",
  component: PamOrgNavSlotComponent,
  render: (args) => ({
    props: args,
    template: `
      <bit-side-nav>
        <app-pam-org-nav-slot [organization]="organization" />
      </bit-side-nav>
    `,
  }),
} as Meta<PamOrgNavSlotComponent>;

type Story = StoryObj<PamOrgNavSlotComponent>;

/** Both permissions granted, rotation off — the shipped shape of the group today. */
export const Default: Story = {
  decorators: [nav()],
  args: { organization: organization(true, true) },
};

/** Rotation's own flag on top of the other two, adding the third item. */
export const WithRotation: Story = {
  decorators: [nav({ rotationEnabled: true })],
  args: { organization: organization(true, true) },
};

/** No event-log permission — Audit log drops out, leaving Access rules alone. */
export const AccessRulesOnly: Story = {
  decorators: [nav()],
  args: { organization: organization(true, false) },
};
