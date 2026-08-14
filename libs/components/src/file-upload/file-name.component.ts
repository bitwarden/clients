import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

const LEADING_CHARS = 8;
const MIN_TRAILING_CHARS = 8;
const EXT_BUFFER = 4;

const splitFilename = (name: string): { leading: string; middle: string; trailing: string } => {
  const dotIndex = name.lastIndexOf(".");
  const extLength = dotIndex > 0 ? name.length - dotIndex : 0;
  const trailingChars = Math.max(MIN_TRAILING_CHARS, extLength + EXT_BUFFER);

  // Short names fit whole; keeping them in one span avoids a needless split.
  if (name.length <= LEADING_CHARS + trailingChars) {
    return { leading: name, middle: "", trailing: "" };
  }

  const lastStart = name.length - trailingChars;
  return {
    leading: name.slice(0, LEADING_CHARS),
    middle: name.slice(LEADING_CHARS, lastStart),
    trailing: name.slice(lastStart),
  };
};

@Component({
  selector: "bit-file-name",
  template: `
    <span class="tw-contents tw-text-sm" [attr.title]="name()">
      <span class="tw-flex-none">{{ parts().leading }}</span>
      <span class="tw-truncate tw-min-w-0">{{ parts().middle }}</span>
      <span class="tw-flex-none">{{ parts().trailing }}</span>
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-flex tw-overflow-hidden tw-min-w-0" },
})
export class FileNameComponent {
  readonly name = input.required<string>();
  protected readonly parts = computed(() => splitFilename(this.name()));
}
