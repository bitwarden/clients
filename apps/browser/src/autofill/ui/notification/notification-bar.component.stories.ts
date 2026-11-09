import { Meta, StoryObj, componentWrapperDecorator, moduleMetadata } from "@storybook/angular";

import { NotificationTypes } from "../../notification/abstractions/notification-bar";
import {
  mockCollections,
  mockFolders,
  mockNotificationCiphers,
  mockOrganizations,
} from "../shared/story-mock-data";
import { autofillStoryProviders } from "../shared/story-providers";

import { NotificationBarComponent } from "./notification-bar.component";

export default {
  title: "Browser/Autofill/Notification Bar",
  component: NotificationBarComponent,
  decorators: [
    moduleMetadata({ providers: autofillStoryProviders }),
    componentWrapperDecorator((story) => `<div style="width: 400px">${story}</div>`),
  ],
  parameters: {
    chromatic: { modes: { light: { theme: "light" }, dark: { theme: "dark" } } },
  },
} as Meta<NotificationBarComponent>;

type Story = StoryObj<NotificationBarComponent>;

export const Save: Story = {
  args: { state: { view: NotificationTypes.Add, ciphers: mockNotificationCiphers } },
};

export const SaveWithVaultAndFolder: Story = {
  args: {
    state: {
      view: NotificationTypes.Add,
      ciphers: mockNotificationCiphers,
      organizations: mockOrganizations,
      folders: mockFolders,
    },
  },
};

export const SaveWithCollections: Story = {
  args: {
    state: {
      view: NotificationTypes.Add,
      organizations: mockOrganizations,
      collections: mockCollections,
    },
  },
};

export const SavePersonalVaultDisallowed: Story = {
  args: {
    state: {
      view: NotificationTypes.Add,
      organizations: mockOrganizations.slice(0, 1),
      collections: mockCollections,
      personalVaultAllowed: false,
    },
  },
};

export const SaveLoading: Story = {
  args: { state: { view: NotificationTypes.Add, loading: true } },
};

export const Update: Story = {
  args: { state: { view: NotificationTypes.Change, ciphers: mockNotificationCiphers } },
};

export const Unlock: Story = {
  args: { state: { view: NotificationTypes.Unlock } },
};

export const Saved: Story = {
  args: { state: { view: "confirmation", type: NotificationTypes.Add, itemName: "Example login" } },
};

export const Updated: Story = {
  args: {
    state: { view: "confirmation", type: NotificationTypes.Change, itemName: "Example login" },
  },
};

export const SavedLongItemName: Story = {
  args: {
    state: {
      view: "confirmation",
      type: NotificationTypes.Add,
      itemName: "A login with a very long name that keeps going well past the available width",
    },
  },
};

export const UpdatedTasksRemaining: Story = {
  args: {
    state: {
      view: "confirmation",
      type: NotificationTypes.Change,
      itemName: "Example login",
      task: { orgName: "Acme, Inc.", remainingTasksCount: 3 },
    },
  },
};

export const UpdatedTasksComplete: Story = {
  args: {
    state: {
      view: "confirmation",
      type: NotificationTypes.Change,
      itemName: "Example login",
      task: { orgName: "Acme, Inc.", remainingTasksCount: 0 },
    },
  },
};

export const SaveFailed: Story = {
  args: {
    state: {
      view: "confirmation",
      type: NotificationTypes.Add,
      itemName: "Example login",
      error: "Save failed",
    },
  },
};

export const AtRiskPassword: Story = {
  args: {
    state: {
      view: NotificationTypes.AtRiskPassword,
      organizationName: "Acme, Inc.",
      passwordChangeUri: true,
    },
  },
};

export const AtRiskPasswordNoChangeLink: Story = {
  args: {
    state: {
      view: NotificationTypes.AtRiskPassword,
      organizationName: "Acme, Inc.",
      passwordChangeUri: false,
    },
  },
};
