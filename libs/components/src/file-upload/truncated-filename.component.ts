import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { A11yTitleDirective } from "../a11y";

const splitFilename = (name: string): { firstThreeFourths: string; lastFourth: string } => {
  const splitIndex = Math.floor((name.length * 3) / 4);
  return { firstThreeFourths: name.slice(0, splitIndex), lastFourth: name.slice(splitIndex) };
};

@Component({
  selector: "bit-truncated-filename",
  template: `
    <span class="tw-contents" [appA11yTitle]="name()">
      <span class="tw-truncate tw-min-w-0">{{ parts().firstThreeFourths }}</span>
      <span class="tw-flex-none">{{ parts().lastFourth }}</span>
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-flex tw-overflow-hidden tw-min-w-0" },
  imports: [A11yTitleDirective],
})
export class TruncatedFilenameComponent {
  readonly name = input.required<string>();
  protected readonly parts = computed(() => splitFilename(this.name()));
}
