/** What a fill request carries, beyond its account. */
export const FillRequestKind = Object.freeze({
  /** A page transition's report. */
  Reported: "reported",
  /** A tab the request carries. */
  Tab: "tab",
  /** A tab and a cipher the request carries. */
  Cipher: "cipher",
  /** A tab, a cipher, and the page details the request carries. */
  Page: "page",
} as const);
export type FillRequestKind = (typeof FillRequestKind)[keyof typeof FillRequestKind];

/** Where a fill's page comes from. */
export const PageSource = Object.freeze({
  /** The page collected from the target. */
  Collect: "collect",
  /** The page details the fill request carries. */
  FillRequest: "fillRequest",
} as const);
export type PageSource = (typeof PageSource)[keyof typeof PageSource];

/** Where a fill's cipher comes from. */
export const CipherSource = Object.freeze({
  /** A login, chosen for the target's URL. */
  Login: "login",
  /** The next card in the rotation. */
  Card: "card",
  /** The next identity in the rotation. */
  Identity: "identity",
  /** The cipher the fill request carries. */
  FillRequest: "fillRequest",
} as const);
export type CipherSource = (typeof CipherSource)[keyof typeof CipherSource];

/** How a login is chosen for a URL. */
export const LoginChoice = Object.freeze({
  /** The next login in the URL's rotation. */
  Next: "next",
  /** A login launched recently, else the last one used. */
  Recent: "recent",
  /**
   * As {@link LoginChoice.Recent}, among the logins allowed to fill eagerly: those whose
   * autofill-on-page-load setting allows it.
   */
  ForEagerFill: "forEagerFill",
} as const);
export type LoginChoice = (typeof LoginChoice)[keyof typeof LoginChoice];

/**
 * How a fill handles the master-password reprompt of its cipher. Asking the user ends the fill; the
 * user's confirmation requests a new fill, whose plan says the reprompt is confirmed.
 */
export const RepromptAction = Object.freeze({
  /**
   * For a fill that can prompt the user: when the cipher requires the reprompt and the user has a
   * master password, asks the user and denies the fill.
   */
  Ask: "ask",
  /** For a fill that cannot prompt the user: denies the fill of a cipher that requires it. */
  Refuse: "refuse",
  /**
   * For a fill the user confirmed the reprompt for: the confirmation covers the cipher the request
   * carries.
   */
  Confirmed: "confirmed",
} as const);
export type RepromptAction = (typeof RepromptAction)[keyof typeof RepromptAction];

/** Work that follows a commit that filled. */
export const FillEffectKind = Object.freeze({
  /** Advances the rotation, so the next fill offers the next cipher. */
  Cycle: "cycle",
  /** Copies the filled cipher's TOTP code when the user's preference permits it. */
  CopyTotp: "copyTotp",
  /** Refreshes the inline menu's ciphers. */
  RefreshOverlay: "refreshOverlay",
  /** Records activity for the request's account. */
  RecordActivity: "recordActivity",
} as const);
export type FillEffectKind = (typeof FillEffectKind)[keyof typeof FillEffectKind];

/** Whether an absent fill is re-attempted. */
export const FillReattempt = Object.freeze({
  /** The fill is not re-attempted. */
  None: "none",
  /** The fill is re-attempted once, after a slow page has had time to render. */
  SlowRender: "slowRender",
} as const);
export type FillReattempt = (typeof FillReattempt)[keyof typeof FillReattempt];
