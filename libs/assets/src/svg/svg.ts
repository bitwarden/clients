class BitSvg {
  constructor(readonly svg: string) {}
}

// We only export the type to prohibit the creation of Svgs without using
// the `svg` template literal tag.
export type { BitSvg };

export function isBitSvg(svgContent: unknown): svgContent is BitSvg {
  return svgContent instanceof BitSvg;
}

export class DynamicContentNotAllowedError extends Error {
  constructor() {
    super("Dynamic content in icons is not allowed due to risk of user-injected XSS.");
  }
}

export function svg(strings: TemplateStringsArray, ...values: unknown[]): BitSvg {
  if (values.length > 0) {
    throw new DynamicContentNotAllowedError();
  }

  return new BitSvg(strings[0]);
}
