import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { autofillStoryProviders } from "../shared/story-providers";

import { NotificationOptionSelectComponent } from "./notification-option-select.component";

export default {
  title: "Browser/Autofill/Notification Bar/Option Select",
  component: NotificationOptionSelectComponent,
  decorators: [moduleMetadata({ providers: autofillStoryProviders })],
  args: {
    name: "folder",
    label: "Folder",
    options: [
      { value: "0", text: "No folder", icon: "bwi-folder", default: true },
      { value: "folder-1", text: "Work", icon: "bwi-folder" },
      { value: "folder-2", text: "Something else entirely, with a long name", icon: "bwi-folder" },
    ],
  },
} as Meta<NotificationOptionSelectComponent>;

type Story = StoryObj<NotificationOptionSelectComponent>;

export const Default: Story = {};

export const Selected: Story = {
  args: { value: "folder-2" },
};
