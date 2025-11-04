import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";

// Page loading component for quick initial loads
// Uses standard icon spinner with proper centering and layout
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "dirt-page-loading",
  imports: [JslibModule],
  template: `
    <div class="tw-flex tw-justify-center tw-items-center tw-min-h-[70vh]">
      <div class="tw-text-center tw-flex tw-flex-col tw-items-center tw-gap-4">
        <i
          class="bwi bwi-spinner bwi-spin bwi-3x tw-text-primary-600"
          title="{{ 'loading' | i18n }}"
          aria-hidden="true"
        ></i>
        <div class="tw-text-main tw-text-base">
          {{ "loading" | i18n }}
        </div>
      </div>
    </div>
  `,
})
export class PageLoadingComponent {}
