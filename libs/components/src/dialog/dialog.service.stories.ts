import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";
import { NoopAnimationsModule, provideAnimations } from "@angular/platform-browser/animations";
import { RouterTestingModule } from "@angular/router/testing";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { getAllByRole, userEvent } from "@storybook/test";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule } from "../button";
import { IconButtonModule } from "../icon-button";
import { LayoutComponent } from "../layout";
import { SharedModule } from "../shared";
import { positionFixedWrapperDecorator } from "../stories/storybook-decorators";
import { I18nMockService } from "../utils/i18n-mock.service";

import { DialogModule } from "./dialog.module";
import { DialogService } from "./dialog.service";

interface Animal {
  animal: string;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  template: `
    <bit-layout>
      <button class="tw-mr-2" bitButton type="button" (click)="openDialog()">Open Dialog</button>
      <button class="tw-mr-2" bitButton type="button" (click)="openDialogNonDismissable()">
        Open Non-Dismissable Dialog
      </button>
      <button bitButton type="button" (click)="openDrawer()">Open Drawer</button>
    </bit-layout>
  `,
  imports: [ButtonModule, LayoutComponent],
})
class StoryDialogComponent {
  constructor(public dialogService: DialogService) {}

  openDialog() {
    this.dialogService.open(StoryDialogContentComponent, {
      data: {
        animal: "panda",
      },
    });
  }

  openDialogNonDismissable() {
    this.dialogService.open(NonDismissableContent, {
      data: {
        animal: "panda",
      },
      disableClose: true,
    });
  }

  openDrawer() {
    this.dialogService.openDrawer(StoryDialogContentComponent, {
      data: {
        animal: "panda",
      },
    });
  }
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  template: `
    <bit-dialog title="Dialog Title" dialogSize="large">
      <span bitDialogContent>
        Dialog body text goes here.
        <br />
        Animal: {{ animal }}
      </span>
      <ng-container bitDialogFooter>
        <button type="button" bitButton buttonType="primary" (click)="dialogRef.close()">
          Save
        </button>
        <button type="button" bitButton buttonType="secondary" bitDialogClose>Cancel</button>
      </ng-container>
    </bit-dialog>
  `,
  imports: [DialogModule, ButtonModule],
})
class StoryDialogContentComponent {
  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) private data: Animal,
  ) {}

  get animal() {
    return this.data?.animal;
  }
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  template: `
    <bit-dialog
      title="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore"
      dialogSize="large"
    >
      <span bitDialogContent>
        Dialog body text goes here.
        <br />
        Animal: {{ animal }}
      </span>
      <ng-container bitDialogFooter>
        <button type="button" bitButton buttonType="primary" (click)="dialogRef.close()">
          Save
        </button>
      </ng-container>
    </bit-dialog>
  `,
  imports: [DialogModule, ButtonModule],
})
class NonDismissableContent {
  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) private data: Animal,
  ) {}

  get animal() {
    return this.data?.animal;
  }
}

export default {
  title: "Component Library/Dialogs/Service",
  component: StoryDialogComponent,
  decorators: [
    positionFixedWrapperDecorator(),
    moduleMetadata({
      imports: [
        SharedModule,
        ButtonModule,
        NoopAnimationsModule,
        DialogModule,
        IconButtonModule,
        RouterTestingModule,
        LayoutComponent,
      ],
      providers: [DialogService],
    }),
    applicationConfig({
      providers: [
        provideAnimations(),
        DialogService,
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              close: "Close",
              search: "Search",
              skipToContent: "Skip to content",
              submenu: "submenu",
              toggleCollapse: "toggle collapse",
              toggleSideNavigation: "Toggle side navigation",
              yes: "Yes",
              no: "No",
              loading: "Loading",
            });
          },
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-30495&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta;

type Story = StoryObj<StoryDialogComponent>;

export const Default: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;

    const button = getAllByRole(canvas, "button")[0];
    await userEvent.click(button);
  },
};

export const NonDismissable: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;

    const button = getAllByRole(canvas, "button")[1];
    await userEvent.click(button);
  },
};

/** Drawers must be a descendant of `bit-layout`. */
export const Drawer: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;

    const button = getAllByRole(canvas, "button")[2];
    await userEvent.click(button);
  },
};
