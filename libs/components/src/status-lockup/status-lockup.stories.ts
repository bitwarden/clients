import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import {
  ActiveSendIcon,
  type BitSvg,
  DeactivatedOrg,
  DevicesIcon,
  DomainIcon,
  EmptyTrash,
  GearIcon,
  NoCredentialsIcon,
  NoFolders,
  NoResults,
  NoSendsIcon,
  RestrictedView,
  Security,
  VaultOpen,
} from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule } from "../button";
import { IconComponent } from "../icon";
import { IconTileComponent } from "../icon-tile";
import { BitwardenIcon, BITWARDEN_ICONS } from "../shared/icon";
import { SvgComponent } from "../svg";
import { I18nMockService } from "../utils";

import { StatusLockupComponent } from "./status-lockup.component";

export default {
  title: "Component Library/Status Lockup",
  component: StatusLockupComponent,
  decorators: [
    moduleMetadata({
      imports: [
        ButtonModule,
        StatusLockupComponent,
        SvgComponent,
        IconTileComponent,
        IconComponent,
      ],
      providers: [
        {
          provide: I18nService,
          useValue: new I18nMockService({ loading: "Loading" }),
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=21665-25102&t=k6OTDDPZOTtypRqo-11",
    },
  },
} as Meta;

/** Additional typing is for story-only knobs. */
type Story = StoryObj<StatusLockupComponent & { svg?: BitSvg; icon?: BitwardenIcon }>;

const Svgs = {
  EmptyTrash,
  NoFolders,
  NoResults,
  NoSendsIcon,
  VaultOpen,
  DeactivatedOrg,
  ActiveSendIcon,
  DevicesIcon,
  Security,
  NoCredentialsIcon,
  RestrictedView,
  DomainIcon,
  GearIcon,
};

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <bit-status-lockup class="tw-text-main">
      <bit-svg slot="graphic" [content]="svg"></bit-svg>
      <ng-container slot="title">No items found</ng-container>
      <ng-container slot="description">
        Your description here. It could be a bit of a longer description, but ideally not too long for this type of component. Enough to give some context!
      </ng-container>
      <button
          slot="button"
          type="button"
          bitButton
          buttonType="secondary"
      >
          <bit-icon name="bwi-plus" />
          New item
      </button>
    </bit-status-lockup>
    `,
  }),
  args: {
    svg: NoResults,
  },
  argTypes: {
    svg: {
      options: Object.keys(Svgs),
      mapping: Svgs,
      control: { type: "select" },
    },
  },
};

export const Small: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <bit-status-lockup class="tw-text-main" size="small">
      <bit-svg slot="graphic" [content]="svg"></bit-svg>
      <ng-container slot="title">No items found</ng-container>
      <ng-container slot="description">
        Your description here. It could be a bit of a longer description, but ideally not too long for this type of component. Enough to give some context!
      </ng-container>
      <button
          slot="button"
          type="button"
          bitButton
          buttonType="secondary"
      >
          <bit-icon name="bwi-plus" />
          New item
      </button>
    </bit-status-lockup>
    `,
  }),
  args: {
    svg: NoResults,
  },
  argTypes: {
    svg: {
      options: Object.keys(Svgs),
      mapping: Svgs,
      control: { type: "select" },
    },
  },
};

export const Responsive: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <div class="tw-border tw-border-solid tw-border-secondary-300 tw-resize-x tw-overflow-auto"
    style="width: 24rem; max-width: 100%;">
      <bit-status-lockup class="tw-text-main">
        <bit-svg slot="graphic" [content]="svg"></bit-svg>
        <ng-container slot="title">No items found</ng-container>
        <ng-container slot="description">
          Your description here. It could be a bit of a longer description, but ideally not too long for this type of component. Enough to give some context!
        </ng-container>
        <button
            slot="button"
            type="button"
            bitButton
            buttonType="secondary"
        >
            <bit-icon name="bwi-plus" />
            New item
        </button>
      </bit-status-lockup>
    </div>
    `,
  }),
  args: {
    svg: NoResults,
  },
  argTypes: {
    svg: {
      options: Object.keys(Svgs),
      mapping: Svgs,
      control: { type: "select" },
    },
  },
  parameters: {
    // Story doesn't capture anything that Default and Small don't; more intended for interaction
    chromatic: { disableSnapshot: true },
  },
};

export const WithIconTile: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <bit-status-lockup class="tw-text-main">
      <bit-icon-tile slot="graphic" [icon]="icon"></bit-icon-tile>
      <ng-container slot="title">No items found</ng-container>
      <ng-container slot="description">
        Your description here. It could be a bit of a longer description, but ideally not too long for this type of component. Enough to give some context!
      </ng-container>
      <button
          slot="button"
          type="button"
          bitButton
          buttonType="secondary"
      >
          <bit-icon name="bwi-plus" />
          New item
      </button>
    </bit-status-lockup>
    `,
  }),
  args: {
    icon: "bwi-wrench",
  },
  argTypes: {
    icon: {
      options: BITWARDEN_ICONS,
      control: { type: "select" },
    },
  },
};

export const NoGraphic: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <bit-status-lockup class="tw-text-main">
      <ng-container slot="title">No items found</ng-container>
      <ng-container slot="description">
        Your description here. It could be a bit of a longer description, but ideally not too long for this type of component. Enough to give some context!
      </ng-container>
      <button
          slot="button"
          type="button"
          bitButton
          buttonType="secondary"
      >
          <bit-icon name="bwi-plus" />
          New item
      </button>
    </bit-status-lockup>
    `,
  }),
};

export const NoButton: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <bit-status-lockup class="tw-text-main">
      <bit-svg slot="graphic" [content]="svg"></bit-svg>
      <ng-container slot="title">No items found</ng-container>
      <ng-container slot="description">
        Your description here. It could be a bit of a longer description, but ideally not too long for this type of component. Enough to give some context!
      </ng-container>
    </bit-status-lockup>
    `,
  }),
  args: {
    svg: NoResults,
  },
  argTypes: {
    svg: {
      options: Object.keys(Svgs),
      mapping: Svgs,
      control: { type: "select" },
    },
  },
};
