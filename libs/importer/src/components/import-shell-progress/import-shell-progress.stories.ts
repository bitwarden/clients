import { ChangeDetectionStrategy, Component } from "@angular/core";
import { provideRouter, RouterOutlet, Routes, withHashLocation } from "@angular/router";
import { applicationConfig, Decorator, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { ImportShellProgressComponent } from "./import-shell-progress.component";

/**
 * Mirrors how every real shell embeds this component: declared directly in the shell's own
 * template, alongside the router-outlet for its step children — never behind another outlet. See
 * the class doc comment on ImportShellProgressComponent for why that placement matters; a stubbed
 * `ActivatedRoute` can't exercise it, per `.claude/rules/storybook-routing.md`.
 */
@Component({
  selector: "story-shell",
  template: `<importer-shell-progress></importer-shell-progress><router-outlet></router-outlet>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportShellProgressComponent, RouterOutlet],
})
class StoryShellComponent {}

@Component({
  selector: "story-step-one",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StoryStepOneComponent {}

@Component({
  selector: "story-step-two",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StoryStepTwoComponent {}

const routes: Routes = [
  {
    path: "import",
    component: StoryShellComponent,
    children: [
      { path: "", pathMatch: "full", component: StoryStepOneComponent },
      { path: ":importType", component: StoryStepTwoComponent },
    ],
  },
];

/** Renders the story at `url`; hash routing keeps Storybook's own query string intact. */
const atUrl =
  (url: string): Decorator =>
  (storyFn, context) => {
    window.location.hash = url;
    return storyFn(context);
  };

export default {
  title: "Tools/Import/Shell Progress",
  component: ImportShellProgressComponent,
  render: () => ({ template: `<router-outlet></router-outlet>` }),
  decorators: [
    moduleMetadata({ imports: [RouterOutlet] }),
    applicationConfig({
      providers: [
        provideRouter(routes, withHashLocation()),
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              importSourceBreadcrumb: "Select source",
              importData: "Import data",
              importSourceStepCount: (current?: string, total?: string) =>
                `Step ${current} of ${total}`,
            }),
        },
      ],
    }),
  ],
} as Meta<ImportShellProgressComponent>;

type Story = StoryObj<ImportShellProgressComponent>;

/** Step 1: "Select source" heading, progress bar at half. */
export const StepOne: Story = {
  decorators: [atUrl("/import")],
};

/** Step 2: "Import data" heading, progress bar full. */
export const StepTwo: Story = {
  decorators: [atUrl("/import/keeper")],
};
