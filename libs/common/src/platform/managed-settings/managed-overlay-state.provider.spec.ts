import { BehaviorSubject, Observable, Subject, firstValueFrom } from "rxjs";

import {
  ActiveUserState,
  GlobalState,
  KeyDefinition,
  SingleUserState,
  StateDefinition,
  UserKeyDefinition,
} from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

import { __resetOverlaysForTests, defineManagedOverlay } from "./managed-overlay-registry";
import {
  OverlayActiveUserStateProvider,
  OverlayGlobalStateProvider,
  OverlaySingleUserStateProvider,
} from "./managed-overlay-state.provider";

const SD = new StateDefinition("overlayProviderTest", "disk");
const KEY = new KeyDefinition<number>(SD, "len", { deserializer: (v) => v });
const USER_KEY = new UserKeyDefinition<number>(SD, "userLen", {
  deserializer: (v) => v,
  clearOn: [],
});

function makeManagedSettings(initialValue?: string) {
  const managed = { value: initialValue };
  const changes$ = new Subject<void>();
  const service = {
    changes$,
    get: (_key: string) => managed.value,
    isManaged: (_key: string) => managed.value != null,
  } as any;
  return { service, managed, fireChange: () => changes$.next() };
}

describe("OverlayGlobalStateProvider", () => {
  beforeEach(() => {
    __resetOverlaysForTests();
  });

  it("emits stored value when key is not managed (no overlay registered)", async () => {
    const stored$ = new BehaviorSubject<number>(12);
    const innerHolder: GlobalState<number> = { state$: stored$, update: jest.fn() } as any;
    const inner = { get: () => innerHolder } as any;
    const { service } = makeManagedSettings(undefined);

    const provider = new OverlayGlobalStateProvider(inner, service);
    expect(await firstValueFrom(provider.get(KEY).state$)).toBe(12);
  });

  it("emits managed value when key is managed and overlay is registered", async () => {
    defineManagedOverlay({ keyDefinition: KEY, coerce: (get) => JSON.parse(get("test.len")!) });
    const stored$ = new BehaviorSubject<number>(12);
    const innerHolder: GlobalState<number> = { state$: stored$, update: jest.fn() } as any;
    const inner = { get: () => innerHolder } as any;
    const { service } = makeManagedSettings("99");

    const provider = new OverlayGlobalStateProvider(inner, service);
    expect(await firstValueFrom(provider.get(KEY).state$)).toBe(99);
  });

  it("updates to managed value after changes$ fires (config-value reactivity)", () => {
    defineManagedOverlay({
      keyDefinition: KEY,
      coerce: (get) => {
        const raw = get("test.len");
        return raw == null ? null : (JSON.parse(raw) as number);
      },
    });
    const stored$ = new BehaviorSubject<number>(12);
    const innerHolder: GlobalState<number> = { state$: stored$, update: jest.fn() } as any;
    const inner = { get: () => innerHolder } as any;
    const { service, managed, fireChange } = makeManagedSettings(undefined);

    const provider = new OverlayGlobalStateProvider(inner, service);
    const emissions: number[] = [];
    const sub = provider.get(KEY).state$.subscribe((v) => emissions.push(v));

    managed.value = "42";
    fireChange();
    sub.unsubscribe();

    expect(emissions[0]).toBe(12);
    expect(emissions[emissions.length - 1]).toBe(42);
  });

  it("registers the overlay after get() and takes effect on next changes$ tick", () => {
    const stored$ = new BehaviorSubject<number>(12);
    const innerHolder: GlobalState<number> = { state$: stored$, update: jest.fn() } as any;
    const inner = { get: () => innerHolder } as any;
    const { service, managed, fireChange } = makeManagedSettings(undefined);

    const provider = new OverlayGlobalStateProvider(inner, service);
    const holder = provider.get(KEY);
    const emissions: number[] = [];
    const sub = holder.state$.subscribe((v) => emissions.push(v));

    // Register the overlay after get() was already called
    defineManagedOverlay({
      keyDefinition: KEY,
      coerce: (get) => {
        const raw = get("test.len");
        return raw == null ? null : (JSON.parse(raw) as number);
      },
    });
    managed.value = "42";
    fireChange();
    sub.unsubscribe();

    expect(emissions[0]).toBe(12);
    expect(emissions[emissions.length - 1]).toBe(42);
  });

  it("delegates non-state$ members (update) to the inner holder", async () => {
    defineManagedOverlay({ keyDefinition: KEY, coerce: (get) => JSON.parse(get("test.len")!) });
    const updateFn = jest.fn();
    const innerHolder: GlobalState<number> = {
      state$: new BehaviorSubject(12),
      update: updateFn,
    } as any;
    const inner = { get: () => innerHolder } as any;
    const { service } = makeManagedSettings("99");

    const provider = new OverlayGlobalStateProvider(inner, service);
    const holder = provider.get(KEY);
    await (holder as any).update(() => 5);
    expect(updateFn).toHaveBeenCalled();
  });
});

describe("OverlaySingleUserStateProvider", () => {
  const USER_ID = "user-1" as UserId;

  beforeEach(() => {
    __resetOverlaysForTests();
  });

  it("emits stored value when key is not managed (no overlay registered)", async () => {
    const stored$ = new BehaviorSubject<number>(7);
    const innerHolder: SingleUserState<number> = { state$: stored$, update: jest.fn() } as any;
    const inner = { get: () => innerHolder } as any;
    const { service } = makeManagedSettings(undefined);

    const provider = new OverlaySingleUserStateProvider(inner, service);
    expect(await firstValueFrom(provider.get(USER_ID, USER_KEY).state$)).toBe(7);
  });

  it("emits managed value when key is managed and overlay is registered", async () => {
    defineManagedOverlay({
      keyDefinition: USER_KEY,
      coerce: (get) => JSON.parse(get("test.userLen")!),
    });
    const stored$ = new BehaviorSubject<number>(7);
    const innerHolder: SingleUserState<number> = { state$: stored$, update: jest.fn() } as any;
    const inner = { get: () => innerHolder } as any;
    const { service } = makeManagedSettings("55");

    const provider = new OverlaySingleUserStateProvider(inner, service);
    expect(await firstValueFrom(provider.get(USER_ID, USER_KEY).state$)).toBe(55);
  });

  it("registers the overlay after get() and takes effect on next changes$ tick", () => {
    const stored$ = new BehaviorSubject<number>(7);
    const innerHolder: SingleUserState<number> = { state$: stored$, update: jest.fn() } as any;
    const inner = { get: () => innerHolder } as any;
    const { service, managed, fireChange } = makeManagedSettings(undefined);

    const provider = new OverlaySingleUserStateProvider(inner, service);
    const holder = provider.get(USER_ID, USER_KEY);
    const emissions: number[] = [];
    const sub = holder.state$.subscribe((v) => emissions.push(v));

    // Register the overlay after get() was already called
    defineManagedOverlay({
      keyDefinition: USER_KEY,
      coerce: (get) => JSON.parse(get("test.userLen")!),
    });
    managed.value = "88";
    fireChange();
    sub.unsubscribe();

    expect(emissions[0]).toBe(7);
    expect(emissions[emissions.length - 1]).toBe(88);
  });

  it("delegates non-state$ members (update) to the inner holder", async () => {
    const updateFn = jest.fn();
    const innerHolder: SingleUserState<number> = {
      state$: new BehaviorSubject(7),
      update: updateFn,
    } as any;
    const inner = { get: () => innerHolder } as any;
    const { service } = makeManagedSettings(undefined);

    const provider = new OverlaySingleUserStateProvider(inner, service);
    await (provider.get(USER_ID, USER_KEY) as any).update(() => 5);
    expect(updateFn).toHaveBeenCalled();
  });
});

describe("OverlayActiveUserStateProvider", () => {
  beforeEach(() => {
    __resetOverlaysForTests();
  });

  it("emits stored value when key is not managed (no overlay registered)", async () => {
    const stored$ = new BehaviorSubject<number>(3);
    const innerHolder: ActiveUserState<number> = { state$: stored$, update: jest.fn() } as any;
    const activeUserId$ = new Observable<UserId | undefined>();
    const inner = { get: () => innerHolder, activeUserId$ } as any;
    const { service } = makeManagedSettings(undefined);

    const provider = new OverlayActiveUserStateProvider(inner, service);
    expect(await firstValueFrom(provider.get(USER_KEY).state$)).toBe(3);
  });

  it("emits managed value when key is managed and overlay is registered", async () => {
    defineManagedOverlay({
      keyDefinition: USER_KEY,
      coerce: (get) => JSON.parse(get("test.userLen")!),
    });
    const stored$ = new BehaviorSubject<number>(3);
    const innerHolder: ActiveUserState<number> = { state$: stored$, update: jest.fn() } as any;
    const activeUserId$ = new Observable<UserId | undefined>();
    const inner = { get: () => innerHolder, activeUserId$ } as any;
    const { service } = makeManagedSettings("77");

    const provider = new OverlayActiveUserStateProvider(inner, service);
    expect(await firstValueFrom(provider.get(USER_KEY).state$)).toBe(77);
  });

  it("registers the overlay after get() and takes effect on next changes$ tick", () => {
    const stored$ = new BehaviorSubject<number>(3);
    const innerHolder: ActiveUserState<number> = { state$: stored$, update: jest.fn() } as any;
    const activeUserId$ = new Observable<UserId | undefined>();
    const inner = { get: () => innerHolder, activeUserId$ } as any;
    const { service, managed, fireChange } = makeManagedSettings(undefined);

    const provider = new OverlayActiveUserStateProvider(inner, service);
    const holder = provider.get(USER_KEY);
    const emissions: number[] = [];
    const sub = holder.state$.subscribe((v) => emissions.push(v));

    // Register the overlay after get() was already called
    defineManagedOverlay({
      keyDefinition: USER_KEY,
      coerce: (get) => JSON.parse(get("test.userLen")!),
    });
    managed.value = "11";
    fireChange();
    sub.unsubscribe();

    expect(emissions[0]).toBe(3);
    expect(emissions[emissions.length - 1]).toBe(11);
  });

  it("delegates activeUserId$ from the inner provider", () => {
    const activeUserId$ = new BehaviorSubject<UserId | undefined>(undefined);
    const inner = {
      get: () => ({ state$: new BehaviorSubject(0), update: jest.fn() }),
      activeUserId$,
    } as any;
    const { service } = makeManagedSettings(undefined);

    const provider = new OverlayActiveUserStateProvider(inner, service);
    expect(provider.activeUserId$).toBe(activeUserId$);
  });

  it("delegates non-state$ members (update) to the inner holder", async () => {
    const updateFn = jest.fn();
    const innerHolder: ActiveUserState<number> = {
      state$: new BehaviorSubject(3),
      update: updateFn,
    } as any;
    const inner = {
      get: () => innerHolder,
      activeUserId$: new Observable<UserId | undefined>(),
    } as any;
    const { service } = makeManagedSettings(undefined);

    const provider = new OverlayActiveUserStateProvider(inner, service);
    await (provider.get(USER_KEY) as any).update(() => 5);
    expect(updateFn).toHaveBeenCalled();
  });
});
