import { css } from "@emotion/css";
import { html, LitElement } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { themes, spacing, scrollbarStyles, typography } from "../../constants/styles";
import { componentClassPrefix as notificationBodyClassPrefix } from "../body";
import { componentClassPrefix as notificationHeaderClassPrefix } from "../header";

export type PresentationalNotificationProps = {
  theme?: Theme;
};

const notificationContainerStyles = (theme: Theme) => css`
  color: red;
  position: absolute;
  right: 20px;
  border: 1px solid ${themes[theme].secondary["300"]};
  border-radius: ${spacing["4"]};
  box-shadow: -2px 4px 6px 0px #0000001a;
  background-color: ${themes[theme].background.alt};
  width: 400px;

  [class*="${notificationHeaderClassPrefix}-"] {
    border-radius: ${spacing["4"]} ${spacing["4"]} 0 0;
  }

  [class*="${notificationBodyClassPrefix}-"] {
    margin: ${spacing["3"]} 0 ${spacing["1.5"]} ${spacing["3"]};
    padding-right: ${spacing["3"]};
  }
`;

const notificationBodyStyles = ({ isSafari, theme }: { isSafari: boolean; theme: Theme }) => css`
  ${typography.body1}

  gap: ${spacing["1.5"]};
  display: flex;
  flex-flow: column;
  background-color: ${themes[theme].background.alt};
  max-height: 123px;
  overflow-x: hidden;
  overflow-y: auto;
  white-space: nowrap;
  color: ${themes[theme].text.main};
  font-weight: 400;

  :last-child {
    border-radius: 0 0 ${spacing["4"]} ${spacing["4"]};
  }

  ${isSafari ? scrollbarStyles(theme).safari : scrollbarStyles(theme).default}
`;

class PresentationalNotification extends LitElement {
  protected render() {
    return html`<div class=${notificationContainerStyles(ThemeTypes.Light)}>
      <slot name="header"></slot>
      <div class="${notificationBodyStyles({ isSafari: false, theme: ThemeTypes.Light })}">
        <div>foobar</div>
        <slot name="body"></slot>
      </div>
      <slot name="footer"></slot>
    </div>`;
  }
}

customElements.define("presentational-notification", PresentationalNotification);

export default PresentationalNotification;
