import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import {
  ActiveSendIcon,
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
import { I18nMockService } from "../utils";

import { NoItemsComponent } from "./no-items.component";
import { NoItemsModule } from "./no-items.module";

export default {
  title: "Component Library/No Items",
  component: NoItemsComponent,
  decorators: [
    moduleMetadata({
      imports: [ButtonModule, NoItemsModule],
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

type Story = StoryObj<NoItemsComponent>;

const Icons = {
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
    <bit-no-items class="tw-text-main" [icon]="icon">
      <ng-container slot="title">No items found</ng-container>
      <ng-container slot="description">Your description here.</ng-container>
      <button
          slot="button"
          type="button"
          bitButton
          buttonType="secondary"
      >
          <i class="bwi bwi-plus" aria-hidden="true"></i>
          New item
      </button>
    </bit-no-items>
    `,
  }),
  args: {
    icon: NoResults,
  },
  argTypes: {
    icon: {
      options: Object.keys(Icons),
      mapping: Icons,
      control: { type: "select" },
    },
  },
};
