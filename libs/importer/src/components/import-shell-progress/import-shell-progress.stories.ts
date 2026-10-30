import { ChangeDetectionStrategy, Component } from "@angular/core";
import { provideRouter, RouterOutlet, Routes, withHashLocation } from "@angular/router";
import { applicationConfig, Decorator, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { defer, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { ImportDestinationKind } from "../../models";
import { ImportDestinationServiceAbstraction } from "../../services";

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

@Component({
  selector: "story-location",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StoryLocationComponent {}

const routes: Routes = [
  {
    path: "import",
    component: StoryShellComponent,
    children: [
      { path: "", pathMatch: "full", component: StoryStepOneComponent },
      { path: ":importType", component: StoryStepTwoComponent },
      { path: ":importType/destination", component: StoryLocationComponent },
    ],
  },
];

/** Set by each story's decorator: the progress component only reads `kind` and `hasStep`. */
let firstOptionKind: ImportDestinationKind = ImportDestinationKind.MyVault;

const destinationService = {
  destinations$: defer(() =>
    of({
      options: [{ kind: firstOptionKind }, { kind: ImportDestinationKind.Organization }],
      hasStep: true,
    }),
  ),
} as unknown as ImportDestinationServiceAbstraction;

const withFirstOption =
  (kind: ImportDestinationKind): Decorator =>
  (storyFn, context) => {
    firstOptionKind = kind;
    return storyFn(context);
  };

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
        { provide: ImportDestinationServiceAbstraction, useValue: destinationService },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              importSourceBreadcrumb: "Select source",
              importData: "Import data",
              selectVault: "Select vault",
              selectLocation: "Select location",
              importSourceStepCount: (current?: string, total?: string) =>
                `Step ${current} of ${total}`,
            }),
        },
      ],
    }),
  ],
} as Meta<ImportShellProgressComponent>;

type Story = StoryObj<ImportShellProgressComponent>;

/** Source picker, when location selection follows: "Select source" heading, bar at a third. */
export const StepOne: Story = {
  decorators: [atUrl("/import")],
};

/** Credential parsing, when location selection follows: "Import data" heading, bar at two thirds. */
export const StepTwo: Story = {
  decorators: [atUrl("/import/keeper")],
};

/** Location selection with My vault first: "Select vault" heading, bar full. */
export const LocationVault: Story = {
  decorators: [withFirstOption(ImportDestinationKind.MyVault), atUrl("/import/keeper/destination")],
};

/** Location selection with a My items card: "Select location" heading. */
export const LocationMyItems: Story = {
  decorators: [withFirstOption(ImportDestinationKind.MyItems), atUrl("/import/keeper/destination")],
};
