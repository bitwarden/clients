import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { ButtonModule } from "../../button";
import { DialogTitleContainerDirective } from "../directives/dialog-title-container.directive";

import { IconDirective, SimpleDialogComponent } from "./simple-dialog.component";

export default {
  title: "Component Library/Dialogs/Simple Dialog",
  component: SimpleDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [ButtonModule],
      declarations: [IconDirective, DialogTitleContainerDirective],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/file/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library",
    },
  },
} as Meta;

type Story = StoryObj<SimpleDialogComponent & { useDefaultIcon: boolean }>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-simple-dialog>
        <span bitDialogTitle>Alert Dialog</span>
        <span bitDialogContent>Message Content</span>
        <ng-container bitDialogFooter>
          <button bitButton buttonType="primary">Yes</button>
          <button bitButton buttonType="secondary">No</button>
        </ng-container>
      </bit-simple-dialog>
    `,
  }),
};

export const CustomIcon: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-simple-dialog>
        <i bitDialogIcon class="bwi bwi-star tw-text-3xl tw-text-success" aria-hidden="true"></i>
        <span bitDialogTitle>Premium Subscription Available</span>
        <span bitDialogContent> Message Content</span>
        <ng-container bitDialogFooter>
          <button bitButton buttonType="primary">Yes</button>
          <button bitButton buttonType="secondary">No</button>
        </ng-container>
      </bit-simple-dialog>
    `,
  }),
};

export const ScrollingContent: Story = {
  render: (args: SimpleDialogComponent) => ({
    props: args,
    template: `
      <bit-simple-dialog>
        <span bitDialogTitle>Alert Dialog</span>
        <span bitDialogContent>
          Message Content Message text goes here.<br />
          <ng-container *ngFor="let _ of [].constructor(100)">
            repeating lines of characters <br />
          </ng-container>
          end of sequence!
        </span>
        <ng-container bitDialogFooter>
          <button bitButton buttonType="primary">Yes</button>
          <button bitButton buttonType="secondary">No</button>
        </ng-container>
      </bit-simple-dialog>
    `,
  }),
  args: {
    useDefaultIcon: true,
  },
};

export const TextOverflow: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-simple-dialog>
        <span bitDialogTitle>Alert Dialogdialogdialogdialogdialogdialogdialogdialogdialogdialogdialogdialogdialog</span>
        <span bitDialogContent>Message Contentcontentcontentcontentcontentcontentcontentcontentcontentcontentcontent</span>
        <ng-container bitDialogFooter>
          <button bitButton buttonType="primary">Yes</button>
          <button bitButton buttonType="secondary">No</button>
        </ng-container>
      </bit-simple-dialog>
    `,
  }),
};
