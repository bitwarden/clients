import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { A11yTitleDirective } from "../a11y";

const splitFilename = (
  name: string,
): { firstFourth: string; middleHalf: string; lastFourth: string } => {
  const firstEnd = Math.floor((name.length * 15) / 100);
  const lastStart = Math.floor((name.length * 4) / 5);
  return {
    firstFourth: name.slice(0, firstEnd),
    middleHalf: name.slice(firstEnd, lastStart),
    lastFourth: name.slice(lastStart),
  };
};

@Component({
  selector: "bit-truncated-filename",
  template: `
    <span class="tw-contents" [appA11yTitle]="name()">
      <span class="tw-flex-none">{{ parts().firstFourth }}</span>
      <span class="tw-truncate tw-min-w-0">{{ parts().middleHalf }}</span>
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
