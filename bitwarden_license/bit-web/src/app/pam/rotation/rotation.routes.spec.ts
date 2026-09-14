import { ActivatedRouteSnapshot, Route } from "@angular/router";

import { daemonDetailDiscardGuard } from "./daemons/daemon-detail.component";
import { rotationConfigEditDiscardGuard } from "./managed-credentials/rotation-config-edit.component";
import { ROTATION_TABS } from "./rotation-links";
import { rotationRoutes } from "./rotation.routes";

/** The route declared at `path`, or a failure that names the path rather than one that doesn't. */
function routeAt(path: string): Route {
  const route = rotationRoutes.find((candidate) => candidate.path === path);
  if (route == null) {
    throw new Error(`No rotation route is declared at "${path}"`);
  }
  return route;
}

/** A snapshot with only what the re-run rule reads off it. */
function snapshotOf(params: Record<string, string>): ActivatedRouteSnapshot {
  return { params } as unknown as ActivatedRouteSnapshot;
}

/** Whether the route would re-run its guards for this move, asked the way the router asks. */
function rerunsGuards(
  route: Route,
  from: Record<string, string>,
  to: Record<string, string>,
): boolean {
  const rule = route.runGuardsAndResolvers;
  if (typeof rule !== "function") {
    throw new Error(`Expected "${route.path}" to decide guard re-runs with a function`);
  }
  return rule(snapshotOf(from), snapshotOf(to));
}

describe("rotationRoutes", () => {
  describe("the managed credential edit page", () => {
    const tabRoute = () => routeAt(`${ROTATION_TABS.managedCredentials}/:configId/:tab`);

    it("holds an exit for unsaved input", () => {
      expect(tabRoute().canDeactivate).toEqual([rotationConfigEditDiscardGuard]);
    });

    it("leaves the guard alone for a move between the page's own tabs", () => {
      const stayed = rerunsGuards(
        tabRoute(),
        { configId: "cfg-1", tab: "configuration" },
        { configId: "cfg-1", tab: "history" },
      );

      expect(stayed).toBe(false);
    });

    it("re-runs the guard when the URL names a different credential", () => {
      const left = rerunsGuards(
        tabRoute(),
        { configId: "cfg-1", tab: "configuration" },
        { configId: "cfg-2", tab: "configuration" },
      );

      expect(left).toBe(true);
    });
  });

  describe("the access connector detail page", () => {
    const tabRoute = () => routeAt(`${ROTATION_TABS.accessConnectors}/:daemonId/:tab`);

    it("holds an exit for unsaved input", () => {
      expect(tabRoute().canDeactivate).toEqual([daemonDetailDiscardGuard]);
    });

    it("leaves the guard alone for a move between the page's own tabs", () => {
      const stayed = rerunsGuards(
        tabRoute(),
        { daemonId: "con-1", tab: "configuration" },
        { daemonId: "con-1", tab: "history" },
      );

      expect(stayed).toBe(false);
    });

    it("re-runs the guard when the URL names a different connector", () => {
      const left = rerunsGuards(
        tabRoute(),
        { daemonId: "con-1", tab: "configuration" },
        { daemonId: "con-2", tab: "configuration" },
      );

      expect(left).toBe(true);
    });
  });

  it("guards the create page, which has no tab of its own to move between", () => {
    const create = routeAt(`${ROTATION_TABS.managedCredentials}/new`);

    expect(create.canDeactivate).toEqual([rotationConfigEditDiscardGuard]);
    expect(create.runGuardsAndResolvers).toBeUndefined();
  });
});
