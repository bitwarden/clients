class Icon {
  constructor(readonly svg: string) {}
}

// We only export the type to prohibit the creation of Icons without using
// the `svgIcon` template literal tag.
export type { Icon };

export function isIcon(icon: unknown): icon is Icon {
  return icon instanceof Icon;
}

export class DynamicContentNotAllowedError extends Error {
  constructor() {
    super("Dynamic content in icons is not allowed due to risk of user-injected XSS.");
  }
}

export function svgIcon(strings: TemplateStringsArray, ...values: unknown[]): Icon {
  if (values.length > 0) {
    throw new DynamicContentNotAllowedError();
  }

  return new Icon(strings[0]);
}
