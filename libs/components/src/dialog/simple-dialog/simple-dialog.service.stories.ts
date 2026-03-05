import { DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, inject } from "@angular/core";
import { provideAnimations } from "@angular/platform-browser/animations";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { getAllByRole, userEvent } from "storybook/test";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule } from "../../button";
import { I18nMockService } from "../../utils/i18n-mock.service";
import { DialogModule } from "../dialog.module";
import { CenterPositionStrategy, DialogService } from "../dialog.service";

interface Animal {
  animal: string;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  template: `
    <button type="button" bitButton (click)="openSimpleDialog()">Open Simple Dialog</button>
    <button type="button" bitButton (click)="openNonDismissableWithPrimaryButtonDialog()">
      Open Non-Dismissable Simple Dialog with Primary Button
    </button>
    <button type="button" bitButton (click)="openNonDismissableWithNoButtonsDialog()">
      Open Non-Dismissable Simple Dialog with No Buttons
    </button>
  `,
  imports: [ButtonModule],
})
class StoryDialogComponent {
  dialogService = inject(DialogService);

  openSimpleDialog() {
    this.dialogService.open(SimpleDialogContentComponent, {
      data: {
        animal: "panda",
      },
      positionStrategy: new CenterPositionStrategy(),
    });
  }

  openNonDismissableWithPrimaryButtonDialog() {
    this.dialogService.open(NonDismissableWithPrimaryButtonContentComponent, {
      data: {
        animal: "panda",
      },
      disableClose: true,
      positionStrategy: new CenterPositionStrategy(),
    });
  }

  openNonDismissableWithNoButtonsDialog() {
    this.dialogService.open(NonDismissableWithNoButtonsContentComponent, {
      data: {
        animal: "panda",
      },
      disableClose: true,
      positionStrategy: new CenterPositionStrategy(),
    });
  }
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  template: `
    <bit-simple-dialog>
      <span bitDialogTitle>Dialog Title</span>
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
    </bit-simple-dialog>
  `,
  imports: [ButtonModule, DialogModule],
})
class SimpleDialogContentComponent {
  dialogRef = inject(DialogRef);
  private data = inject<Animal>(DIALOG_DATA);

  get animal() {
    return this.data?.animal;
  }
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  template: `
    <bit-simple-dialog>
      <span bitDialogTitle>Dialog Title</span>
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
    </bit-simple-dialog>
  `,
  imports: [ButtonModule, DialogModule],
})
class NonDismissableWithPrimaryButtonContentComponent {
  dialogRef = inject(DialogRef);
  private data = inject<Animal>(DIALOG_DATA);

  get animal() {
    return this.data?.animal;
  }
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  template: `
    <bit-simple-dialog>
      <span bitDialogTitle>Dialog Title</span>
      <span bitDialogContent>
        Dialog body text goes here.
        <br />
        Animal: {{ animal }}
      </span>
    </bit-simple-dialog>
  `,
  imports: [ButtonModule, DialogModule],
})
class NonDismissableWithNoButtonsContentComponent {
  dialogRef = inject(DialogRef);
  private data = inject<Animal>(DIALOG_DATA);

  get animal() {
    return this.data?.animal;
  }
}

export default {
  title: "Component Library/Dialogs/Service/Simple",
  component: StoryDialogComponent,
  decorators: [
    moduleMetadata({
      providers: [
        provideAnimations(),
        DialogService,
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
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=21514-19247&t=b5tDKylm5sWm2yKo-4",
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

export const NonDismissableWithPrimaryButton: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;

    const button = getAllByRole(canvas, "button")[1];
    await userEvent.click(button);
  },
};

export const NonDismissableWithNoButtons: Story = {
  play: async (context) => {
    const canvas = context.canvasElement;

    const button = getAllByRole(canvas, "button")[2];
    await userEvent.click(button);
  },
};
