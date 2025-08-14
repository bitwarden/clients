import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { ButtonModule } from "../../button";
import { DialogModule } from "../dialog.module";

import { SimpleDialogComponent } from "./simple-dialog.component";

export default {
  title: "Component Library/Dialogs/Simple Dialog",
  component: SimpleDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [ButtonModule, NoopAnimationsModule, DialogModule],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=21514-19247&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta;

type Story = StoryObj<SimpleDialogComponent & { useDefaultIcon: boolean }>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-simple-dialog>
        <span bitDialogTitle>Alert Dialog</span>
        <span bitDialogContent>Message Content</span>
        <ng-container bitDialogFooter>
          <button type="button" bitButton buttonType="primary">Yes</button>
          <button type="button" bitButton buttonType="secondary">No</button>
        </ng-container>
      </bit-simple-dialog>
    `,
  }),
};

export const CustomIcon: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-simple-dialog>
        <i bitDialogIcon class="bwi bwi-star tw-text-3xl tw-text-success" aria-hidden="true"></i>
        <span bitDialogTitle>Premium Subscription Available</span>
        <span bitDialogContent> Message Content</span>
        <ng-container bitDialogFooter>
          <button type="button" bitButton buttonType="primary">Yes</button>
          <button type="button" bitButton buttonType="secondary">No</button>
        </ng-container>
      </bit-simple-dialog>
    `,
  }),
};

export const HideIcon: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-simple-dialog hideIcon>
        <span bitDialogTitle>Premium Subscription Available</span>
        <span bitDialogContent> Message Content</span>
        <ng-container bitDialogFooter>
          <button type="button" bitButton buttonType="primary">Yes</button>
          <button type="button" bitButton buttonType="secondary">No</button>
        </ng-container>
      </bit-simple-dialog>
    `,
  }),
};

export const ScrollingContent: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
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
          <button type="button" bitButton buttonType="primary">Yes</button>
          <button type="button" bitButton buttonType="secondary">No</button>
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
    template: /*html*/ `
      <bit-simple-dialog>
        <span bitDialogTitle>Alert Dialogdialogdialogdialogdialogdialogdialogdialogdialogdialogdialogdialogdialog</span>
        <span bitDialogContent>Message Contentcontentcontentcontentcontentcontentcontentcontentcontentcontentcontent</span>
        <ng-container bitDialogFooter>
          <button type="button" bitButton buttonType="primary">Yes</button>
          <button type="button" bitButton buttonType="secondary">No</button>
        </ng-container>
      </bit-simple-dialog>
    `,
  }),
};
