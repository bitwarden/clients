export const litMock = {
  html: jest.fn((_strings: TemplateStringsArray, ...values: unknown[]) => values),
  nothing: Symbol("nothing"),
};
