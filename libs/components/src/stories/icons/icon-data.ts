const statusIndicators = [
  {
    id: "bwi-check",
    usage:
      'Indicates a user action has been successful. Can also indicate a "selected" state in menus and other patterns where a user can select from multiple elements. Often used with success color variables.',
  },
  {
    id: "bwi-error",
    usage:
      "Indicates a user action has been unsuccessful. Differently from the warning icon, error indicates that the user cannot proceed with their intended action due to a violated rule or system issue until that state has been resolved. Often used with error color variables.",
  },
  {
    id: "bwi-exclamation-triangle",
    usage:
      "Indicates that a user action might lead to a problem or that there's elevated risk if the user proceeds. Does not necessarily block the user from continuing. Often used with warning color variables.",
  },
  {
    id: "bwi-info-circle",
    usage:
      "Indicates that the associated content is informational, rather than actionable. Can be used as an interactive affordance, displaying a tooltip.",
  },
  {
    id: "bwi-question-circle",
    usage:
      "Indicates a piece of data or content that is a question. Can be used as an interactive affordance, linking to help documentation.",
  },
  {
    id: "bwi-spinner",
    usage:
      "Indicates that the action is loading. Should only be used in nested components that require their own component-level loading state such as buttons.",
  },
];

const bitwardenObjects = [
  {
    id: "bwi-business",
    usage:
      "Indicates actions or elements that are related to organizations, Teams plan, Enterprise plan.",
  },
  {
    id: "bwi-collection",
    usage: "Indicates a collection.",
  },
  {
    id: "bwi-collection-shared",
    usage: "Indicates a collection.",
  },
  {
    id: "bwi-credit-card",
    usage: "Indicates a credit card item type.",
  },
  {
    id: "bwi-dashboard",
    usage: "Indicates access intelligence or reports.",
  },
  {
    id: "bwi-family",
    usage:
      "Indicates actions or elements that are related to a family vault, organization, or family plans.",
  },
  {
    id: "bwi-folder",
    usage: "Indicates a folder.",
  },
  {
    id: "bwi-globe",
    usage: "Indicates a login item type.",
  },
  {
    id: "bwi-id-card",
    usage: "Indicates an identity item type.",
  },
  {
    id: "bwi-premium",
    usage: "Relates to premium plans or actions.",
  },
  {
    id: "bwi-send",
    usage:
      'Indicates the Send feature. Can also be used to indicate a "send" action. Do not use this variation in navigation on mobile or extension. Prefer specific navigation icons.',
  },
  {
    id: "bwi-sticky-note",
    usage: "Indicates a secure note item type.",
  },
  {
    id: "bwi-users",
    usage:
      "Indicates a group in the context of organizations. Can also indicate multiple users in a more general context.",
  },
  {
    id: "bwi-vault",
    usage:
      "Indicates the vault. Do not use this variation in bottom navigation on mobile or extension. Prefer specific navigation icons.",
  },
];

const actions = [
  {
    id: "bwi-archive",
    usage:
      "Moves selected items to the Archive. Can also be used to indicate the Archive page or feature in navigation.",
  },
  {
    id: "bwi-check-circle",
    usage:
      'As an action, indicates the "check if password has been exposed" action. Can also be used as an alternative to the "check" icon to indicate a success status.',
  },
  {
    id: "bwi-clone",
    usage: "Copies data to the clipboard.",
  },
  {
    id: "bwi-close",
    usage:
      'Close or dismiss action. Can be used as an affordance to close windows, modals, and drawers. Should not be confused with the "clear" icon which is used to clear content or selections from an input.',
  },
  {
    id: "bwi-cog",
    usage:
      'Opens settings or options for a related field or page. In a toggle application like an icon button, use the default state to indicate "off" or "closed".',
  },
  {
    id: "bwi-cog-f",
    usage:
      'Closes settings or options for a related field or page. In a toggle application like an icon button, use the filled state to indicate "on" or "open".',
  },
  {
    id: "bwi-download",
    usage: "Downloads the associated file or data.",
  },
  {
    id: "bwi-envelope",
    usage: "Related to email or sending a message.",
  },
  {
    id: "bwi-external-link",
    usage: "Opens a link in a new window or popout.",
  },
  {
    id: "bwi-eye",
    usage:
      'Turns visibility on. In a toggle affordance the default state should be displayed when the data visibility is currently "off" or "not visible".',
  },
  {
    id: "bwi-eye-slash",
    usage:
      'Turns visibility off. In a toggle affordance, the "off" state should be displayed when the data is currently visible.',
  },
  {
    id: "bwi-files",
    usage: "Clone action/duplicate an item",
  },
  {
    id: "bwi-generate",
    usage: "Opens the password or username generator.",
  },
  {
    id: "bwi-import",
    usage: "Import or upload a file.",
  },
  {
    id: "bwi-lock",
    usage: 'Unlock action. Use the lock icon to indicate a "locked" state.',
  },
  {
    id: "bwi-lock-encrypted",
    usage: "",
  },
  {
    id: "bwi-lock-f",
    usage:
      'Lock vault action. Can also be used to indicate that the status of an element or content is in a "locked" state. Prefer the outline lock icon for most cases.',
  },
  {
    id: "bwi-minus-circle",
    usage:
      "Remove, subtract, or delete action. This outlined version should primarily be placed in a component with a transparent background, such as a link or tertiary button. If using in a filled or outline button or FAB, prefer the standard subtract button.",
  },
  {
    id: "bwi-pencil-square",
    usage: "Edit action.",
  },
  {
    id: "bwi-popout",
    usage: "Opens a page in a new window—similar to a pop out action.",
  },
  {
    id: "bwi-plus",
    usage:
      "New, add, or increase action. This version with no outline should be used in most cases.",
  },
  {
    id: "bwi-plus-circle",
    usage:
      "New, add, or increase action. This outlined version should primarily be placed in a component with a transparent background, such as a link or tertiary button. If using in a filled or outline button or FAB, prefer the standard add button.",
  },
  {
    id: "bwi-refresh",
    usage: "Refresh action. Reloads selected screen or element.",
  },
  {
    id: "bwi-search",
    usage: "Search action",
  },
  {
    id: "bwi-share",
    usage: "Share action. Typically opens a share sheet or menu with share options.",
  },
  {
    id: "bwi-sign-in",
    usage: "Login or sign-in action.",
  },
  {
    id: "bwi-sign-out",
    usage: "Logout or sign-out action.",
  },
  {
    id: "bwi-star",
    usage:
      'Favorite action. Use the outline version of this icon to indicate the unselected or "not favorited" state.',
  },
  {
    id: "bwi-star-f",
    usage:
      'Unfavorite action. Use the filled version of this icon to indicate the selected or "favorited" state.',
  },
  {
    id: "bwi-trash",
    usage: "Delete action. Can also be used to indicate a trash folder or area.",
  },
  {
    id: "bwi-unarchive",
    usage: "Unarchive action. Removes an item from the archive.",
  },
  {
    id: "bwi-undo",
    usage: "Undo or restore action.",
  },
  {
    id: "bwi-unlock",
    usage: 'Lock action. Use the unlock icon to indicate an "unlocked" state.',
  },
];

const directionalMenuIndicators = [
  {
    id: "bwi-angle-down",
    usage: "If used in collapse/expand section, indicates collapsed state.",
  },
  {
    id: "bwi-angle-left",
    usage: "In iOS, indicates the back action.",
  },
  {
    id: "bwi-angle-right",
    usage:
      'In mobile, indicates a "push" or that selecting an item will open push the view to a new screen.',
  },
  {
    id: "bwi-angle-up",
    usage: "If used in collapse/expand section, indicates expanded state.",
  },
  {
    id: "bwi-down-solid",
    usage: "Expanded selection. Click to collapse the associated section.",
  },
  {
    id: "bwi-drag-and-drop",
    usage: "Drag and drop handle",
  },
  {
    id: "bwi-ellipsis-h",
    usage:
      "More options. Use the horizontal version for menus that effect individual items, content, or data.",
  },
  {
    id: "bwi-ellipsis-v",
    usage:
      "More options. Use the vertical version for menus that effect groups of items, content, or data, or full pages.",
  },
  {
    id: "bwi-filter",
    usage: "Switch to grid view.",
  },
  {
    id: "bwi-list",
    usage: "Switch to list view.",
  },
  {
    id: "bwi-list-alt",
    usage: "",
  },
  {
    id: "bwi-numbered-list",
    usage: "Switch to numbered list view.",
  },
  {
    id: "bwi-up-down-btn",
    usage:
      "In tables, indicates a sortable column. When this icon is present, the associated column is not the sorting column. When clicked, replace the up-down icon with an arrow-down or arrow-up depending on whether the column is sorted in ascending or descending order.",
  },
  {
    id: "bwi-up-solid",
    usage: "",
  },
];

const miscObjects = [
  {
    id: "bwi-bell",
    usage: "Indicates a notification or message.",
  },
  {
    id: "bwi-billing",
    usage: "Relates to payment and billing.",
  },
  {
    id: "bwi-browser",
    usage: "Indicates a web browser or browser window.",
  },
  {
    id: "bwi-brush",
    usage: "Indicates appearance settings.",
  },
  {
    id: "bwi-bug",
    usage: "Indicates a test or debug action.",
  },
  {
    id: "bwi-camera",
    usage: "Used for actions related to camera use, like scanning a QR code.",
  },
  {
    id: "bwi-cli",
    usage: "Relates to cli client or code.",
  },
  {
    id: "bwi-clock",
    usage: "Used for time-based actions or views.",
  },
  {
    id: "bwi-desktop",
    usage: "Indicates the desktop client.",
  },
  {
    id: "bwi-dollar",
    usage: "Used for account credit.",
  },
  {
    id: "bwi-file",
    usage: "File-related objects or actions. Can also indicate a file send.",
  },
  {
    id: "bwi-file-text",
    usage: "Text related objects or actions. Can also indicate a text send.",
  },
  {
    id: "bwi-hashtag",
    usage: "Link to specific ID.",
  },
  {
    id: "bwi-key",
    usage: "Key or password related objects or actions.",
  },
  {
    id: "bwi-mobile",
    usage: "Indicates the mobile clients.",
  },
  {
    id: "bwi-msp",
    usage: "Indicates an MSP.",
  },
  {
    id: "bwi-paperclip",
    usage: "Indicates an attachment or an attach action.",
  },
  {
    id: "bwi-passkey",
    usage: "Indicates a passkey.",
  },
  {
    id: "bwi-pencil",
    usage: "Edit action.",
  },
  {
    id: "bwi-provider",
    usage: "Can be used to indicate an item or action related to a provider.",
  },
  {
    id: "bwi-puzzle",
    usage: "Indicates the browser extension client.",
  },
  {
    id: "bwi-shield",
    usage: "Indicates the Bitwarden brand or Bitwarden-branded elements.",
  },
  {
    id: "bwi-sliders",
    usage: "Adjust or refine options.",
  },
  {
    id: "bwi-tag",
    usage: "Indicates a label or a tag affordance.",
  },
  {
    id: "bwi-universal-access",
    usage: "Indicates accessbility-related settings and actions.",
  },
  {
    id: "bwi-user",
    usage: "Relates to current user or organization member.",
  },
  {
    id: "bwi-user-monitor",
    usage: "Indicates a user of the desktop client or web app.",
  },
  {
    id: "bwi-wireless",
    usage: "Used to indicate wifi or wireless status.",
  },
  {
    id: "bwi-wrench",
    usage: "Used to indicate tools.",
  },
];

const platformsAndLogos = [
  {
    id: "bwi-bitcoin",
    usage: "Indicates Bitcoin and cryptocurrency.",
  },
  {
    id: "bwi-paypal",
    usage: "Indicates PayPal.",
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
