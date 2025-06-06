import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";
import { provideAnimations } from "@angular/platform-browser/animations";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule } from "../button";
import { I18nMockService } from "../utils/i18n-mock.service";

import { DialogModule } from "./dialog.module";
import { DialogService } from "./dialog.service";

interface Animal {
  animal: string;
}

@Component({
  template: `<button bitButton type="button" (click)="openDialog()">Open Dialog</button>`,
  imports: [ButtonModule],
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
}

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

export default {
  title: "Component Library/Dialogs/Service",
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

export const Default: Story = {};
