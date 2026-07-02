import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BadgeModule } from "../badge";
import { I18nMockService } from "../utils/i18n-mock.service";

import { BadgeGroupComponent } from "./badge-group.component";

export default {
  title: "Component Library/Badge/Group",
  component: BadgeGroupComponent,
  decorators: [
    moduleMetadata({
      imports: [BadgeGroupComponent, BadgeModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => new I18nMockService({}),
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<BadgeGroupComponent>;

export const Default: Story = {
  render: () => ({
    template: `
      <div style="width: 600px;">
        <bit-badge-group>
          <span bitBadge variant="subtle">Personal</span>
          <span bitBadge variant="subtle">Work</span>
          <span bitBadge variant="success">Shared</span>
          <span bitBadge variant="warning">Archived</span>
          <span bitBadge variant="primary">Favorite</span>
        </bit-badge-group>
      </div>
    `,
  }),
};

export const Narrow: Story = {
  render: () => ({
    template: `
      <div style="width: 200px;">
        <bit-badge-group>
          <span bitBadge variant="subtle">Personal</span>
          <span bitBadge variant="subtle">Work</span>
          <span bitBadge variant="success">Shared</span>
          <span bitBadge variant="warning">Archived</span>
          <span bitBadge variant="primary">Favorite</span>
        </bit-badge-group>
      </div>
    `,
  }),
};

export const Mixed: Story = {
  render: () => ({
    template: `
      <div style="width: 300px;">
        <bit-badge-group>
          <span bitBadge variant="success" startIcon="bwi-check-circle">Active</span>
          <span bitBadge variant="danger">Expired</span>
          <span bitBadge variant="subtle">Draft</span>
          <span bitBadge variant="primary">Pinned</span>
        </bit-badge-group>
      </div>
    `,
  }),
};
