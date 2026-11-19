import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FormControlModule, IconModule } from "@bitwarden/components";
import { SharedFolderFieldFolder, SharedFolderFieldHint } from "@bitwarden/vault";

import { controlledSharedFolder } from "./controlled-shared-folder";

/** Stands in for the folder names while the sentence is split, so the names can be italicised. */
const NAMES_MARKER = "\uE000";

/** One run of the sentence; folder names are italicised. */
type HintSegment = { readonly text: string; readonly name: boolean };

/**
 * The hint under the cipher form's Shared folders field naming the item's folders under controlled
 * access, since such an item needs an approved access request to use. The options and chips mark
 * those folders with a lock alone, so this hint is the one place the status is put in words, and
 * it has to keep naming the folders for that reason. The host is a polite live region that stays in
 * place while the field shows its hint, so the sentence is announced as the selection changes
 * (`bit-form-field` swaps hints for errors, so it is not there while the field shows an error).
 * Renders nothing while no selected folder is controlled. The vault renders this hint only while
 * `ControlledAccessSharedFolderField` decorates the field, so PAM's flag and the organization's
 * `usePam` are decided there, once, for the locks and the hint alike.
 */
@Component({
  selector: "app-pam-controlled-access-shared-folder-hint",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormControlModule, IconModule],
  host: { class: "tw-block", "aria-live": "polite" },
  template: `
    @if (segments(); as segments) {
      <bit-hint data-testid="controlled-access-hint">
        <bit-icon name="bwi-lock-encrypted" class="tw-me-1" aria-hidden="true" />
        @for (segment of segments; track $index) {
          @if (segment.name) {
            <em>{{ segment.text }}</em>
          } @else {
            <span>{{ segment.text }}</span>
          }
        }
      </bit-hint>
    }
  `,
})
export class ControlledAccessSharedFolderHintComponent implements SharedFolderFieldHint {
  readonly folders = input.required<SharedFolderFieldFolder[]>();

  private readonly i18nService = inject(I18nService);

  protected readonly segments = computed((): HintSegment[] | null => {
    const names = this.folders()
      .filter((folder) => controlledSharedFolder(folder.collection))
      .map((folder) => folder.name);
    if (names.length === 0) {
      return null;
    }
    const key =
      names.length === 1 ? "pamSharedFolderFieldHintSingular" : "pamSharedFolderFieldHintPlural";
    const listFormat = new Intl.ListFormat(this.i18nService.translationLocale || undefined, {
      type: "conjunction",
    });
    const pieces = this.i18nService.t(key, NAMES_MARKER).split(NAMES_MARKER);
    if (pieces.length !== 2) {
      // A translation that dropped or repeated the placeholder: show it whole, without italics.
      return [{ text: this.i18nService.t(key, listFormat.format(names)), name: false }];
    }
    const [before, after] = pieces;
    return [
      { text: before, name: false },
      ...listFormat
        .formatToParts(names)
        .map((part) => ({ text: part.value, name: part.type === "element" })),
      { text: after, name: false },
    ].filter((segment) => segment.text !== "");
  });
}
