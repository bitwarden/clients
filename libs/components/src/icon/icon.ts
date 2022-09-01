class Icon {
  constructor(readonly svg: string) {}
}

export type { Icon };

export class DynamicContentNotAllowedError extends Error {
  constructor() {
    super("Dynamic content in icons is not allowed due to risk of user-injected XSS.");
  }
}

export function svgIcon(strings: TemplateStringsArray, ...values): Icon {
  if (values.length > 0) {
    throw new DynamicContentNotAllowedError();
  }

  return new Icon(strings[0]);
}
