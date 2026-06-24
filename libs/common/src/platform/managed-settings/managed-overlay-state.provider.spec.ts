import { BehaviorSubject, Observable, firstValueFrom } from "rxjs";

import { GlobalState, KeyDefinition, StateDefinition, StateProvider } from "@bitwarden/state";

import { defineManagedOverlay } from "./managed-overlay-registry";
import { ManagedOverlayStateProvider } from "./managed-overlay-state.provider";

const SD = new StateDefinition("overlayProviderTest", "disk");
const LEN = new KeyDefinition<number>(SD, "len", { deserializer: (v) => v });
defineManagedOverlay({
  managedKey: "test.len",
  keyDefinition: LEN,
  coerce: (raw) => JSON.parse(raw) as number,
});

describe("ManagedOverlayStateProvider", () => {
  function build(managed: { isManaged: boolean; value?: string }) {
    const stored$ = new BehaviorSubject(12);
    const innerGlobal: GlobalState<number> = { state$: stored$, update: jest.fn() } as any;
    const inner = { getGlobal: () => innerGlobal } as unknown as StateProvider;

    let changes!: (v: void) => void;
    const changes$ = new Observable((s) => {
      changes = (v) => s.next(v);
    });
    const managedSettings = {
      changes$,
      isManaged: () => managed.isManaged,
      get: () => managed.value,
    } as any;

    return {
      provider: new ManagedOverlayStateProvider(inner, managedSettings),
      fireChange: () => changes(),
    };
  }

  it("emits the stored value when the key is not managed", async () => {
    const { provider } = build({ isManaged: false });
    expect(await firstValueFrom(provider.getGlobal(LEN).state$)).toBe(12);
  });

  it("emits the managed value when the key is managed", async () => {
    const { provider } = build({ isManaged: true, value: "20" });
    expect(await firstValueFrom(provider.getGlobal(LEN).state$)).toBe(20);
  });

  it("re-emits the managed value when changes$ fires", () => {
    const managed = { isManaged: false, value: undefined as string | undefined };
    const { provider, fireChange } = build(managed);
    const emissions: Array<number | null> = [];
    const sub = provider.getGlobal(LEN).state$.subscribe((v) => emissions.push(v));

    managed.isManaged = true;
    managed.value = "20";
    fireChange();
    sub.unsubscribe();

    expect(emissions[0]).toBe(12); // initial: unmanaged → stored value
    expect(emissions[emissions.length - 1]).toBe(20); // after changes$: managed value
  });

  it("passes through state for unregistered keys unchanged", async () => {
    const OTHER = new KeyDefinition<number>(SD, "other", { deserializer: (v) => v });
    const { provider } = build({ isManaged: true, value: "20" });
    // inner returns the same stub for any key in this harness; unregistered → stored value
    expect(await firstValueFrom(provider.getGlobal(OTHER).state$)).toBe(12);
  });
});
