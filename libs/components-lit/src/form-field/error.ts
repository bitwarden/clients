import { html, nothing } from "lit";

/**
 * Renders the `bit-error` equivalent: an assertive live region that stays in the DOM (so
 * additions are announced) and only shows content while `message` is set.
 */
export function renderError(id: string, message: string | null | undefined, classes = "") {
  return html`<div id=${id} aria-live="assertive">
    ${
      message
        ? html`<div class="tw-text-danger tw-text-xs ${classes}">
            <i class="bwi bwi-error" aria-hidden="true"></i> ${message}
          </div>`
        : nothing
    }
  </div>`;
}
