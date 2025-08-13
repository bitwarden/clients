const statusIndicators = [
  {
    id: "bwi-check",
    usage:
      "confirmation action (Example: 'confirm member'), successful confirmation (toast or callout), or shows currently selected option in a menu. Use with success color variable if applicable.",
  },
  {
    id: "bwi-error",
    usage:
      "error; used in form field error states and error toasts, banners, and callouts. Do not use as a close or clear icon. Use with danger color variable.",
  },
  {
    id: "bwi-exclamation-triangle",
    usage:
      "warning; used in warning callouts, banners, and toasts. Use with warning color variable.",
  },
  {
    id: "bwi-info-circle",
    usage: "information; used in info callouts, banners, and toasts. Use with info color variable.",
  },
  {
    id: "bwi-question-circle",
    usage: "link to help documentation or hover tooltip",
  },
  {
    id: "bwi-spinner",
    usage: "loading",
  },
];

const bitwardenObjects = [
  {
    id: "bwi-business",
    usage: "organization or vault for Free, Teams or Enterprise",
  },
  {
    id: "bwi-collection",
    usage: "collection",
  },
  {
    id: "bwi-collection-shared",
    usage: "collection",
  },
  {
    id: "bwi-credit-card",
    usage: "card item type",
  },
  {
    id: "bwi-family",
    usage: "family vault or organization",
  },
  {
    id: "bwi-folder",
    usage: "folder",
  },
  {
    id: "bwi-globe",
    usage: "login item type",
  },
  {
    id: "bwi-id-card",
    usage: "identity item type",
  },
  {
    id: "bwi-send",
    usage: "send action or feature",
  },
  {
    id: "bwi-sticky-note",
    usage: "secure note item type",
  },
  {
    id: "bwi-users",
    usage: "user group",
  },
  {
    id: "bwi-vault",
    usage: "general vault",
  },
];

const actions = [
  {
    id: "bwi-archive",
    usage: "-",
  },
  {
    id: "bwi-check-circle",
    usage: "check if password has been exposed",
  },
  {
    id: "bwi-clone",
    usage: "copy to clipboard action",
  },
  {
    id: "bwi-close",
    usage: "close action",
  },
  {
    id: "bwi-cog",
    usage: "settings",
  },
  {
    id: "bwi-cog-f",
    usage: "settings",
  },
  {
    id: "bwi-download",
    usage: "download or ",
  },
  {
    id: "bwi-envelope",
    usage: "action related to emailing a user",
  },
  {
    id: "bwi-external-link",
    usage: "open in new window or popout",
  },
  {
    id: "bwi-eye",
    usage: "show icon for password fields",
  },
  {
    id: "bwi-eye-slash",
    usage: "hide icon for password fields",
  },
  {
    id: "bwi-files",
    usage: "clone action / duplicate an item",
  },
  {
    id: "bwi-generate",
    usage: "generate action in edit item forms",
  },
  {
    id: "bwi-import",
    usage: "import a file",
  },
  {
    id: "bwi-lock",
    usage: "lock vault action",
  },
  {
    id: "bwi-lock-encrypted",
    usage: "-",
  },
  {
    id: "bwi-lock-f",
    usage: "-",
  },
  {
    id: "bwi-minus-circle",
    usage: "remove action",
  },
  {
    id: "bwi-pencil-square",
    usage: "edit action",
  },
  {
    id: "bwi-popout",
    usage: "popout action",
  },
  {
    id: "bwi-plus",
    usage: "new or add option in contained buttons/links",
  },
  {
    id: "bwi-plus-circle",
    usage: "new or add option in text buttons/links",
  },
  {
    id: "bwi-refresh",
    usage: '"re"-action; such as refresh or regenerate',
  },
  {
    id: "bwi-search",
    usage: "search action",
  },
  {
    id: "bwi-share",
    usage: "-",
  },
  {
    id: "bwi-sign-in",
    usage: "sign-in action",
  },
  {
    id: "bwi-sign-out",
    usage: "sign-out action",
  },
  {
    id: "bwi-star",
    usage: "favorite action",
  },
  {
    id: "bwi-star-f",
    usage: "favorited / unfavorite action",
  },
  {
    id: "bwi-trash",
    usage: "delete action or trash area",
  },
  {
    id: "bwi-undo",
    usage: "restore action",
  },
  {
    id: "bwi-unlock",
    usage: "unlocked",
  },
];

const directionalMenuIndicators = [
  {
    id: "bwi-angle-down",
    usage: "closed dropdown or open expandable section",
  },
  {
    id: "bwi-angle-left",
    usage: "-",
  },
  {
    id: "bwi-angle-right",
    usage: "closed expandable section",
  },
  {
    id: "bwi-angle-up",
    usage: "open dropdown",
  },
  {
    id: "bwi-down-solid",
    usage: "table sort order",
  },
  {
    id: "bwi-drag-and-drop",
    usage: "drag and drop handle",
  },
  {
    id: "bwi-ellipsis-h",
    usage: "more options menu horizontal; used in mobile list items",
  },
  {
    id: "bwi-ellipsis-v",
    usage: "more options menu vertical; used primarily in tables",
  },
  {
    id: "bwi-filter",
    usage: "Product switcher",
  },
  {
    id: "bwi-list",
    usage: "toggle list/grid view",
  },
  {
    id: "bwi-list-alt",
    usage: "view item action in extension",
  },
  {
    id: "bwi-numbered-list",
    usage: "toggle numbered list view",
  },
  {
    id: "bwi-up-down-btn",
    usage: "table sort order",
  },
  {
    id: "bwi-up-solid",
    usage: "table sort order",
  },
];

const miscObjects = [
  {
    id: "bwi-bell",
    usage: "-",
  },
  {
    id: "bwi-billing",
    usage: "billing options",
  },
  {
    id: "bwi-browser",
    usage: "web browser",
  },
  {
    id: "bwi-browser-alt",
    usage: "web browser",
  },
  {
    id: "bwi-brush",
    usage: "-",
  },
  {
    id: "bwi-bug",
    usage: "test or debug action",
  },
  {
    id: "bwi-camera",
    usage: "actions related to camera use",
  },
  {
    id: "bwi-cli",
    usage: "cli client or code",
  },
  {
    id: "bwi-clock",
    usage: "use for time based actions or views",
  },
  {
    id: "bwi-desktop",
    usage: "desktop client",
  },
  {
    id: "bwi-dollar",
    usage: "account credit",
  },
  {
    id: "bwi-file",
    usage: "file related objects or actions",
  },
  {
    id: "bwi-file-text",
    usage: "text related objects or actions",
  },
  {
    id: "bwi-hashtag",
    usage: "link to specific id",
  },
  {
    id: "bwi-key",
    usage: "key or password related objects or actions",
  },
  {
    id: "bwi-mobile",
    usage: "mobile client",
  },
  {
    id: "bwi-msp",
    usage: "-",
  },
  {
    id: "bwi-paperclip",
    usage: "attachments",
  },
  {
    id: "bwi-passkey",
    usage: "passkey",
  },
  {
    id: "bwi-pencil",
    usage: "editing",
  },
  {
    id: "bwi-provider",
    usage: "relates to provider or provider portal",
  },
  {
    id: "bwi-puzzle",
    usage: "-",
  },
  {
    id: "bwi-shield",
    usage: "-",
  },
  {
    id: "bwi-sliders",
    usage: "reporting or filtering",
  },
  {
    id: "bwi-tag",
    usage: "labels",
  },
  {
    id: "bwi-universal-access",
    usage: "use for accessibility related actions",
  },
  {
    id: "bwi-user",
    usage: "relates to current user or organization member",
  },
  {
    id: "bwi-user-monitor",
    usage: "-",
  },
  {
    id: "bwi-wireless",
    usage: "-",
  },
  {
    id: "bwi-wrench",
    usage: "tools or additional configuration options",
  },
];

const platformsAndLogos = [
  {
    id: "bwi-bitcoin",
    usage: "crypto",
  },
  {
    id: "bwi-paypal",
    usage: "PayPal",
  },
];

export const IconStoryData = {
  platformsAndLogos,
  actions,
  bitwardenObjects,
  statusIndicators,
  directionalMenuIndicators,
  miscObjects,
};
