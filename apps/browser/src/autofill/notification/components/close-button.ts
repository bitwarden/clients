import { html, css } from "lit";
import { NotificationBarIframeInitData } from "../abstractions/notification-bar";
import { IconClose } from "./icon-close";

export function CloseButton({
  handleCloseNotification,
  theme,
}: {
  // @TODO use context to avoid prop drilling
  handleCloseNotification: (e: Event) => void;
  theme: NotificationBarIframeInitData["theme"];
}) {
  return html`
    <div class="notification-close">
      <button
        type="button"
        style=${buttonStyles}
        class="neutral"
        id="close-button"
        @click=${handleCloseNotification}
      >
        ${IconClose({ theme })}
      </button>
    </div>
  `;
}

const buttonStyles = css`
  border: 1px solid transparent;
  background-color: transparent;
  cursor: pointer;
  padding: 0.35rem 15px;
`;
