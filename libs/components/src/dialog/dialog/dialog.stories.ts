import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule } from "../../button";
import { IconButtonModule } from "../../icon-button";
import { SharedModule } from "../../shared";
import { TabsModule } from "../../tabs";
import { I18nMockService } from "../../utils/i18n-mock.service";
import { DialogModule } from "../dialog.module";

import { DialogComponent } from "./dialog.component";

export default {
  title: "Component Library/Dialogs/Dialog",
  component: DialogComponent,
  decorators: [
    moduleMetadata({
      imports: [
        DialogModule,
        ButtonModule,
        SharedModule,
        IconButtonModule,
        TabsModule,
        NoopAnimationsModule,
      ],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              close: "Close",
            });
          },
        },
      ],
    }),
  ],
  args: {
    loading: false,
    dialogSize: "small",
  },
  argTypes: {
    _disablePadding: {
      table: {
        disable: true,
      },
    },
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/file/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library",
    },
  },
} as Meta;

type Story = StoryObj<DialogComponent & { title: string }>;

export const Default: Story = {
  render: (args: DialogComponent) => ({
    props: args,
    template: `
      <bit-dialog [dialogSize]="dialogSize" [title]="title" [subtitle]="subtitle" [loading]="loading" [disablePadding]="disablePadding">
        <ng-container bitDialogContent>Dialog body text goes here.</ng-container>
        <ng-container bitDialogFooter>
          <button bitButton buttonType="primary" [disabled]="loading">Save</button>
          <button bitButton buttonType="secondary" [disabled]="loading">Cancel</button>
          <button
            [disabled]="loading"
            class="tw-ml-auto"
            bitIconButton="bwi-trash"
            buttonType="danger"
            size="default"
            title="Delete"
            aria-label="Delete"></button>
        </ng-container>
      </bit-dialog>
    `,
  }),
  args: {
    dialogSize: "default",
    title: "Default",
    subtitle: "Subtitle",
  },
};

export const Small: Story = {
  ...Default,
  args: {
    dialogSize: "small",
    title: "Small",
  },
};

export const LongTitle: Story = {
  ...Default,
  args: {
    dialogSize: "small",
    title: "Long_Title_That_Should_Be_Truncated",
  },
};

export const Large: Story = {
  ...Default,
  args: {
    dialogSize: "large",
    title: "Large",
  },
};

export const Loading: Story = {
  ...Default,
  args: {
    dialogSize: "large",
    loading: true,
    title: "Loading",
  },
};

export const ScrollingContent: Story = {
  render: (args: DialogComponent) => ({
    props: args,
    template: `
      <bit-dialog title="Scrolling Example" [dialogSize]="dialogSize" [loading]="loading" [disablePadding]="disablePadding">
        <span bitDialogContent>
          Dialog body text goes here.<br>
          <ng-container *ngFor="let _ of [].constructor(100)">
            repeating lines of characters <br>
          </ng-container>
          end of sequence!
        </span>
        <ng-container bitDialogFooter>
          <button bitButton buttonType="primary" [disabled]="loading">Save</button>
          <button bitButton buttonType="secondary" [disabled]="loading">Cancel</button>
        </ng-container>
      </bit-dialog>
    `,
  }),
  args: {
    dialogSize: "small",
  },
};

export const TabContent: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-dialog title="Tab Content Example" [dialogSize]="dialogSize" [disablePadding]="disablePadding">
        <span bitDialogContent>
          <bit-tab-group>
              <bit-tab label="First Tab">First Tab Content</bit-tab>
              <bit-tab label="Second Tab">Second Tab Content</bit-tab>
              <bit-tab label="Third Tab">Third Tab Content</bit-tab>
          </bit-tab-group>
        </span>
        <ng-container bitDialogFooter>
          <button bitButton buttonType="primary" [disabled]="loading">Save</button>
          <button bitButton buttonType="secondary" [disabled]="loading">Cancel</button>
        </ng-container>
      </bit-dialog>
    `,
  }),
  args: {
    dialogSize: "large",
    disablePadding: true,
  },
  parameters: {
    docs: {
      storyDescription: `An example of using the \`bitTabGroup\` component within the Dialog. The content padding should be
      disabled (via \`disablePadding\`) so that the tabs are flush against the dialog title.`,
    },
  },
};
