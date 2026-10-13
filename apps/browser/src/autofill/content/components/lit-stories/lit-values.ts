export function litValues(template: unknown): unknown[] {
  return template as unknown[];
}

export function litHandler(values: unknown[], slot: number): (event: Event) => void {
  return values[slot] as (event: Event) => void;
}

export function keyupEvent(
  code: string,
  target: EventTarget,
  init: KeyboardEventInit = {},
  overrides: Record<string, unknown> = {},
): KeyboardEvent {
  const event = new KeyboardEvent("keyup", { code, bubbles: true, ...init });
  Object.defineProperty(event, "target", { value: target });
  Object.assign(event, overrides);
  return event;
}
