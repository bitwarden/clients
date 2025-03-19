import { DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule } from "../../button";
import { IconButtonModule } from "../../icon-button";
import { SharedModule } from "../../shared/shared.module";
import { I18nMockService } from "../../utils/i18n-mock.service";
import { DialogModule } from "../dialog.module";
import { DialogService } from "../dialog.service";

interface Animal {
  animal: string;
}

@Component({
  template: `<button type="button" bitButton (click)="openDialog()">Open Simple Dialog</button>`,
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
  title: "Component Library/Dialogs/Service/Simple",
  component: StoryDialogComponent,
  decorators: [
    moduleMetadata({
      declarations: [StoryDialogContentComponent],
      imports: [
        SharedModule,
        IconButtonModule,
        ButtonModule,
        BrowserAnimationsModule,
        DialogModule,
      ],
      providers: [
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

export const Default: Story = {};
