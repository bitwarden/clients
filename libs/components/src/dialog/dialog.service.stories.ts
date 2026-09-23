import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { NoopAnimationsModule, provideAnimations } from "@angular/platform-browser/animations";
import { RouterTestingModule } from "@angular/router/testing";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { findByRole, getAllByRole, userEvent } from "storybook/test";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { GlobalStateProvider } from "@bitwarden/state";

import { ButtonModule } from "../button";
import { IconButtonModule } from "../icon-button";
import { LayoutComponent } from "../layout";
import { positionFixedWrapperDecorator } from "../stories/storybook-decorators";
import { I18nMockService, StorybookGlobalStateProvider } from "../utils";

import { DrawerRef } from "./dialog-ref";
import { DialogModule } from "./dialog.module";
import { DialogService } from "./dialog.service";

interface Animal {
  animal: string;
}

interface DrawerLevel {
  level: number;
}

@Component({
  template: `
    <bit-layout>
      <button class="tw-mr-2" bitButton type="button" (click)="openDialog()">Open Dialog</button>
      <button class="tw-mr-2" bitButton type="button" (click)="openDialogNonDismissable()">
        Open Non-Dismissable Dialog
      </button>
      <button class="tw-mr-2" bitButton type="button" (click)="openDrawer()">Open Drawer</button>
      <button class="tw-mr-2" bitButton size="small" type="button" (click)="openSmallDrawer()">
        Open Small Drawer
      </button>
      <button bitButton type="button" (click)="openLargeDrawer()">Open Large Drawer</button>
      <button class="tw-ml-2" bitButton type="button" (click)="openStackedDrawer()">
        Open Stacked Drawer
      </button>
    </bit-layout>
  `,
  imports: [ButtonModule, LayoutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StoryDialogComponent {
  dialogService = inject(DialogService);

  openDialog() {
    this.dialogService.open(StoryDialogContentComponent, {
      data: {
        animal: "panda",
      },
    });
  }

  openDialogNonDismissable() {
    this.dialogService.open(NonDismissableContentComponent, {
      data: {
        animal: "panda",
      },
      disableClose: true,
    });
  }

  openDrawer() {
    void this.dialogService.openDrawer(StoryDialogContentComponent, {
      data: {
        animal: "panda",
      },
    });
  }

  openSmallDrawer() {
    void this.dialogService.openDrawer(SmallDrawerContentComponent, {
      data: {
        animal: "panda",
      },
    });
  }

  openLargeDrawer() {
    void this.dialogService.openDrawer(LargeDrawerContentComponent, {
      data: {
        animal: "panda",
      },
    });
  }

  openStackedDrawer() {
    void this.dialogService.openDrawer(StackedDrawerContentComponent, {
      data: { level: 1 },
      closePredicate: async () =>
        await this.dialogService.openSimpleDialog({
          title: "Discard level 1?",
          content: "You have unsaved changes. Close this drawer anyway?",
          type: "warning",
          acceptButtonText: "Discard",
          cancelButtonText: "Keep editing",
        }),
    });
  }
}

@Component({
  template: `
    <bit-dialog title="Dialog Title">
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StoryDialogContentComponent {
  dialogRef = inject(DialogRef);
  private data = inject<Animal>(DIALOG_DATA);

  get animal() {
    return this.data?.animal;
  }
}

@Component({
  template: `
    <bit-dialog
      title="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore"
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class NonDismissableContentComponent {
  dialogRef = inject(DialogRef);
  private data = inject<Animal>(DIALOG_DATA);

  get animal() {
    return this.data?.animal;
  }
}

@Component({
  template: `
    <bit-dialog title="Small Drawer" dialogSize="small">
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class SmallDrawerContentComponent {
  dialogRef = inject(DialogRef);
  private data = inject<Animal>(DIALOG_DATA);

  get animal() {
    return this.data?.animal;
  }
}

@Component({
  template: `
    <bit-dialog title="Large Drawer" dialogSize="large">
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class LargeDrawerContentComponent {
  dialogRef = inject(DialogRef);
  private data = inject<Animal>(DIALOG_DATA);

  get animal() {
    return this.data?.animal;
  }
}

@Component({
  template: `
    <bit-dialog [title]="'Level ' + level + ' Drawer'">
      <div bitDialogContent class="tw-flex tw-flex-col tw-gap-4 tw-items-start">
        <span>This is level {{ level }} of the drawer stack.</span>
        @if (level < 3) {
          <button type="button" bitButton buttonType="secondary" (click)="pushNext()">
            Open Level {{ level + 1 }}
          </button>
        } @else {
          <span>You've reached the deepest level.</span>
        }
      </div>
      <ng-container bitDialogFooter>
        <button type="button" bitButton buttonType="primary" bitDialogClose>Done</button>
      </ng-container>
    </bit-dialog>
  `,
  imports: [DialogModule, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StackedDrawerContentComponent {
  private drawerRef = inject(DrawerRef, { optional: true });
  private dialogService = inject(DialogService);
  private data = inject<DrawerLevel>(DIALOG_DATA);

  get level() {
    return this.data?.level ?? 1;
  }

  pushNext() {
    const nextLevel = this.level + 1;
    this.drawerRef?.stack(StackedDrawerContentComponent, {
      data: { level: nextLevel },
      closePredicate: async () =>
        await this.dialogService.openSimpleDialog({
          title: `Discard level ${nextLevel}?`,
          content: "You have unsaved changes. Close this drawer anyway?",
          type: "warning",
          acceptButtonText: "Discard",
          cancelButtonText: "Keep editing",
        }),
    });
  }
}

export default {
  title: "Component Library/Dialogs/Service",
  component: StoryDialogComponent,
  decorators: [
    positionFixedWrapperDecorator(),
    moduleMetadata({
      imports: [
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
              back: "Back",
              close: "Close",
              search: "Search",
              skipToContent: "Skip to content",
              submenu: "submenu",
              toggleCollapse: "toggle collapse",
              toggleSideNavigation: "Toggle side navigation",
              yes: "Yes",
              no: "No",
              loading: "Loading",
              sideNavigation: "Side navigation",
              skipLink: "Skip link",
            });
          },
        },
        {
          provide: GlobalStateProvider,
          useClass: StorybookGlobalStateProvider,
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

export const DrawerSmall: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;

    const button = getAllByRole(canvas, "button")[3];
    await userEvent.click(button);
  },
};

export const DrawerLarge: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;

    const button = getAllByRole(canvas, "button")[4];
    await userEvent.click(button);
  },
};

/** Two levels deep — the back button is visible on the level 2 drawer. */
export const DrawerStacked: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;

    await userEvent.click(getAllByRole(canvas, "button")[5]);

    const level2Button = await findByRole(canvas, "button", { name: "Open Level 2" });
    await userEvent.click(level2Button);
  },
};
