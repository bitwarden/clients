import createEmotion from "@emotion/css/create-instance";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { NotificationType } from "../../../../notification/abstractions/notification-bar";
import { NotificationCipherData } from "../../cipher/types";
import { scrollbarStyles, spacing, themes, typography } from "../../constants/styles";

export const componentClassPrefix = "notification-body";

export const BodyIcon = {
  Keyhole: "Keyhole",
  Celebrate: "Celebrate",
  Warning: "Warning",
};

export type BodyIconType = (typeof BodyIcon)[keyof typeof BodyIcon];

const { css } = createEmotion({
  key: componentClassPrefix,
});

export function PresentationalNotificationBody({
  ciphers = [],
  i18n,
  notificationType,
  theme = ThemeTypes.Light,
  handleEditOrUpdateAction,
  params = {},
  content,
  icon,
}: {
  ciphers?: NotificationCipherData[];
  customClasses?: string[];
  i18n?: { [key: string]: string };
  notificationType?: NotificationType;
  theme?: Theme;
  handleEditOrUpdateAction?: (e: Event) => void;
  params?: any;
  content: string;
  icon: undefined | BodyIconType;
}) {
  // @TODO get client vendor from context
  const isSafari = false;
  return html` <div class=${notificationBodyStyles({ isSafari, theme })}>${content}</div> `;
}

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
