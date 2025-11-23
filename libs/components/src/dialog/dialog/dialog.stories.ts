import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BadgeModule } from "../../badge";
import { ButtonModule } from "../../button";
import { CardComponent } from "../../card";
import { FormFieldModule } from "../../form-field";
import { IconButtonModule } from "../../icon-button";
import { InputModule } from "../../input";
import { SectionComponent, SectionHeaderComponent } from "../../section";
import { SharedModule } from "../../shared";
import { TabsModule } from "../../tabs";
import { TypographyModule } from "../../typography";
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
        BadgeModule,
        ButtonModule,
        SharedModule,
        IconButtonModule,
        TabsModule,
        NoopAnimationsModule,
        SectionComponent,
        SectionHeaderComponent,
        CardComponent,
        TypographyModule,
        FormsModule,
        ReactiveFormsModule,
        FormFieldModule,
        InputModule,
      ],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              close: "Close",
              loading: "Loading",
            });
          },
        },
      ],
    }),
  ],
  args: {
    loading: false,
    dialogSize: "small",
    disableAnimations: true,
  },
  argTypes: {
    _disablePadding: {
      table: {
        disable: true,
      },
    },
    background: {
      options: ["alt", "default"],
      control: { type: "radio" },
      table: {
        defaultValue: "default",
      },
    },
    disableAnimations: {
      control: { type: "boolean" },
    },
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-30495&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta;

type Story = StoryObj<DialogComponent & { title: string }>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-dialog [dialogSize]="dialogSize" [title]="title" [subtitle]="subtitle" [loading]="loading" [disablePadding]="disablePadding" [disableAnimations]="disableAnimations">
        <ng-container bitDialogTitle>
          <span bitBadge variant="success">Foobar</span>
        </ng-container>
        <ng-container bitDialogContent>Dialog body text goes here.</ng-container>
        <ng-container bitDialogFooter>
          <button type="button" bitButton buttonType="primary" [disabled]="loading">Save</button>
          <button type="button" bitButton buttonType="secondary" [disabled]="loading">Cancel</button>
          <button
            type="button"
            [disabled]="loading"
            class="tw-ms-auto"
            bitIconButton="bwi-trash"
            buttonType="danger"
            size="default"
            label="Delete"></button>
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
    title: "Incredibly_Super_Long_Title_That_Should_Be_Truncated",
  },
};

export const LongTitleSentence: Story = {
  ...Default,
  args: {
    dialogSize: "small",
    title: "Very Long Sentence That Should Be Truncated After Two Lines",
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
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-dialog title="Scrolling Example" [background]="background" [dialogSize]="dialogSize" [loading]="loading" [disablePadding]="disablePadding" [disableAnimations]="disableAnimations">
        <span bitDialogContent>
          Dialog body text goes here.<br />
          <ng-container *ngFor="let _ of [].constructor(100)">
            repeating lines of characters <br />
          </ng-container>
          end of sequence!
        </span>
        <ng-container bitDialogFooter>
          <button type="button" bitButton buttonType="primary" [disabled]="loading">Save</button>
          <button type="button" bitButton buttonType="secondary" [disabled]="loading">Cancel</button>
        </ng-container>
      </bit-dialog>
    `,
  }),
  args: {
    dialogSize: "small",
    disableAnimations: true,
  },
};

export const TabContent: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-dialog title="Tab Content Example" [background]="background" [dialogSize]="dialogSize" [disablePadding]="disablePadding" [disableAnimations]="disableAnimations">
        <span bitDialogContent>
          <bit-tab-group>
              <bit-tab label="First Tab">First Tab Content</bit-tab>
              <bit-tab label="Second Tab">Second Tab Content</bit-tab>
              <bit-tab label="Third Tab">Third Tab Content</bit-tab>
          </bit-tab-group>
        </span>
        <ng-container bitDialogFooter>
          <button type="button" bitButton buttonType="primary" [disabled]="loading">Save</button>
          <button type="button" bitButton buttonType="secondary" [disabled]="loading">Cancel</button>
        </ng-container>
      </bit-dialog>
    `,
  }),
  args: {
    dialogSize: "large",
    disablePadding: true,
    disableAnimations: true,
  },
  parameters: {
    docs: {
      storyDescription: `An example of using the \`bitTabGroup\` component within the Dialog. The content padding should be
      disabled (via \`disablePadding\`) so that the tabs are flush against the dialog title.`,
    },
  },
};

export const WithCards: Story = {
  render: (args) => ({
    props: {
      formObj: new FormGroup({
        name: new FormControl(""),
      }),
      ...args,
    },
    template: /*html*/ `
      <form [formGroup]="formObj">
      <bit-dialog [dialogSize]="dialogSize" [background]="background" [title]="title" [subtitle]="subtitle" [loading]="loading" [disablePadding]="disablePadding" [disableAnimations]="disableAnimations">
        <ng-container bitDialogContent>
          <bit-section>
            <bit-section-header>
              <h2 bitTypography="h6">
                Foo
              </h2>
              <button type="button" label="Favorite" bitIconButton="bwi-star" size="small" slot="end"></button>
            </bit-section-header>
            <bit-card>
              <bit-form-field>
                <bit-label>Label</bit-label>
                <input bitInput formControlName="name" />
                <bit-hint>Optional Hint</bit-hint>
              </bit-form-field>
              <bit-form-field disableMargin>
                <bit-label>Label</bit-label>
                <input bitInput formControlName="name" />
                <bit-hint>Optional Hint</bit-hint>
              </bit-form-field>
            </bit-card>
          </bit-section>
          <bit-section>
            <bit-section-header>
              <h2 bitTypography="h6">
                Bar
              </h2>
              <button label="Favorite" type="button" bitIconButton="bwi-star" size="small" slot="end"></button>
            </bit-section-header>
            <bit-card>
              <bit-form-field>
                <bit-label>Label</bit-label>
                <input bitInput formControlName="name" />
                <bit-hint>Optional Hint</bit-hint>
              </bit-form-field>
              <bit-form-field disableMargin>
                <bit-label>Label</bit-label>
                <input bitInput formControlName="name" />
                <bit-hint>Optional Hint</bit-hint>
              </bit-form-field>
            </bit-card>
          </bit-section>
        </ng-container>
        <ng-container bitDialogFooter>
          <button type="button" bitButton buttonType="primary" [disabled]="loading">Save</button>
          <button type="button" bitButton buttonType="secondary" [disabled]="loading">Cancel</button>
          <button
            type="button"
            [disabled]="loading"
            class="tw-ms-auto"
            bitIconButton="bwi-trash"
            buttonType="danger"
            size="default"
            label="Delete"></button>
        </ng-container>
      </bit-dialog>
  </form>
    `,
  }),
  args: {
    dialogSize: "default",
    title: "Default",
    subtitle: "Subtitle",
    background: "alt",
    disableAnimations: true,
  },
};
