import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";

import { queryParamStore } from "./query-param-store";

describe("queryParamStore (router integration)", () => {
  async function setup(url: string) {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: "**", children: [] }])] });
    const harness = await RouterTestingHarness.create(url);
    return { harness, router: TestBed.inject(Router) };
  }

  it("reads its initial value from the URL, ignoring other namespaces", async () => {
    await setup("/?vault.type=login&vault.favorite=true&other.type=card");
    const store = TestBed.runInInjectionContext(() =>
      queryParamStore<{ type?: string; favorite?: boolean }>("vault"),
    );
    expect(store()).toEqual({ type: "login", favorite: true });
  });

  it("merges initial defaults under the URL", async () => {
    await setup("/?vault.type=login");
    const store = TestBed.runInInjectionContext(() =>
      queryParamStore<{ type?: string; page?: number }>("vault", { page: 1 }),
    );
    expect(store()).toEqual({ page: 1, type: "login" });
  });

  it("writes back to the URL on set", async () => {
    const { router, harness } = await setup("/");
    const store = TestBed.runInInjectionContext(() => queryParamStore<{ type?: string }>("vault"));

    store.set({ type: "card" });
    TestBed.tick();
    await harness.fixture.whenStable();

    expect(router.url).toContain("vault.type=card");
  });

  it("removes a key when it is cleared", async () => {
    const { router, harness } = await setup("/?vault.type=login");
    const store = TestBed.runInInjectionContext(() => queryParamStore<{ type?: string }>("vault"));

    store.set({ type: undefined });
    TestBed.tick();
    await harness.fixture.whenStable();

    expect(router.url).not.toContain("vault.type");
  });

  it("does not merge a stale write into a URL that moved to another page", async () => {
    const { router, harness } = await setup("/a?vault.folder=f1");
    const store = TestBed.runInInjectionContext(() =>
      queryParamStore<{ folder?: string }>("vault"),
    );
    // The first flush agrees with the URL, which is what makes `/a` this store's page.
    TestBed.tick();

    await harness.navigateByUrl("/b");

    // The write a component queues as it is torn down — its state belongs to `/a`.
    store.set({ folder: "f1" });
    TestBed.tick();
    await harness.fixture.whenStable();

    expect(router.url).toBe("/b");
  });

  it("still writes when only the query string changed", async () => {
    const { router, harness } = await setup("/a?vault.folder=f1");
    const store = TestBed.runInInjectionContext(() =>
      queryParamStore<{ folder?: string }>("vault"),
    );
    TestBed.tick();

    await harness.navigateByUrl("/a?other.page=2");

    store.set({ folder: "f2" });
    TestBed.tick();
    await harness.fixture.whenStable();

    expect(router.url).toContain("vault.folder=f2");
  });

  it("seeds from the URL when the namespace is a signal (resolves after creation)", async () => {
    await setup("/?vault.type=login");
    // Mirrors a component input: the store is created before the namespace resolves.
    const ns = signal<string | undefined>(undefined);
    const store = TestBed.runInInjectionContext(() => queryParamStore<{ type?: string }>(ns));
    expect(store()).toEqual({});

    ns.set("vault");
    expect(store()).toEqual({ type: "login" });
  });
});
