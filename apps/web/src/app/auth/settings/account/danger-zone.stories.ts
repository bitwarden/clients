import { CommonModule } from "@angular/common";
import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { ButtonModule } from "@bitwarden/components";

import { PreloadedEnglishI18nModule } from "../../../core/tests";

import { DangerZoneComponent } from "./danger-zone.component";

class MockConfigService implements Partial<ConfigService> {}

export default {
  title: "Web/Danger Zone",
  component: DangerZoneComponent,
  decorators: [
    moduleMetadata({
      imports: [ButtonModule, JslibModule, CommonModule],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        {
          provide: ConfigService,
          useClass: MockConfigService,
          multi: true,
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<DangerZoneComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <app-danger-zone>
        <button type="button" bitButton buttonType="danger">Danger A</button>
        <button type="button" bitButton buttonType="danger">Danger B</button>
      </app-danger-zone>
      `,
  }),
};
