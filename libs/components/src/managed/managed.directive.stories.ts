import { ChangeDetectionStrategy, Component } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { Subject } from "rxjs";

import { ManagedSettingsService } from "@bitwarden/common/platform/managed-settings";

import { FormFieldModule } from "../form-field";

import { BitManagedDirective } from "./managed.directive";

class StoryManagedSettingsService {
  // eslint-disable-next-line rxjs/no-exposed-subjects
  changes$ = new Subject<void>();
  private managed: Set<string>;

  constructor(managedKeys: string[]) {
    this.managed = new Set(managedKeys);
  }

  isManaged(key: string) {
    return this.managed.has(key);
  }
}

@Component({
  selector: "story-managed",
  template: `
    <form [formGroup]="form">
      <bit-form-field>
        <bit-label>Server URL</bit-label>
        <input
          bitInput
          formControlName="baseUrl"
          [bitManaged]="'environment.base'"
          [bitManagedLabel]="'Managed by your organization'"
        />
      </bit-form-field>
    </form>
  `,
  imports: [ReactiveFormsModule, FormFieldModule, BitManagedDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StoryManagedComponent {
  form = new FormGroup({ baseUrl: new FormControl("https://vault.example.com") });
}

export default {
  title: "Component Library/Managed",
  component: StoryManagedComponent,
  decorators: [
    moduleMetadata({
      imports: [StoryManagedComponent],
      providers: [
        {
          provide: ManagedSettingsService,
          useValue: new StoryManagedSettingsService(["environment.base"]),
        },
      ],
    }),
  ],
} as Meta<StoryManagedComponent>;

type Story = StoryObj<StoryManagedComponent>;

export const Managed: Story = {};

export const Unmanaged: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        { provide: ManagedSettingsService, useValue: new StoryManagedSettingsService([]) },
      ],
    }),
  ],
};
