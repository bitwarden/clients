/** Resolves a message key, substituting positional placeholders. */
export type Translator = (key: string, ...params: (string | number | undefined)[]) => string;

let translator: Translator = (key) => key;
const listeners = new Set<() => void>();

/** Called once by the host application to plug in its translation service. */
export function setTranslator(next: Translator) {
  translator = next;
  listeners.forEach((listener) => listener());
}

export function t(key: string, ...params: (string | number | undefined)[]): string {
  return translator(key, ...params);
}

/** Registers a callback for translator changes. Returns an unsubscribe function. */
export function onTranslatorChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
