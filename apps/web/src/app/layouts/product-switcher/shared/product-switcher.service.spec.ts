// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router, convertToParamMap } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { Observable, firstValueFrom, of } from "rxjs";

import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { SyncService } from "@bitwarden/common/platform/sync";

import { ProductSwitcherService } from "./product-switcher.service";

describe("ProductSwitcherService", () => {
  let service: ProductSwitcherService;
  let router: { url: string; events: Observable<unknown> };
  let organizationService: MockProxy<OrganizationService>;
  let providerService: MockProxy<ProviderService>;
  let activeRouteParams = convertToParamMap({ organizationId: "1234" });
  const getLastSync = jest.fn().mockResolvedValue(new Date("2024-05-14"));

  // The service is dependent on the SyncService, which is behind a `setTimeout`
  // Most of the tests don't need to test this aspect so `advanceTimersByTime`
  // is used to simulate the completion of the sync
  function initiateService() {
    service = TestBed.inject(ProductSwitcherService);
    jest.advanceTimersByTime(201);
  }

  beforeEach(() => {
    jest.useFakeTimers();
    getLastSync.mockResolvedValue(new Date("2024-05-14"));
    router = mock<Router>();
    organizationService = mock<OrganizationService>();
    providerService = mock<ProviderService>();

    router.url = "/";
    router.events = of({});
    organizationService.organizations$ = of([{}] as Organization[]);
    providerService.getAll.mockResolvedValue([] as Provider[]);

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: OrganizationService, useValue: organizationService },
        { provide: ProviderService, useValue: providerService },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(activeRouteParams),
            url: of([]),
          },
        },
        {
          provide: I18nPipe,
          useValue: {
            transform: (key: string) => key,
          },
        },
        {
          provide: SyncService,
          useValue: { getLastSync },
        },
      ],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("SyncService", () => {
    it("waits until sync is complete before emitting products", (done) => {
      getLastSync.mockResolvedValue(null);

      initiateService();

      // The subscription will only emit once the sync returns a value
      service.products$.subscribe((products) => {
        expect(products).toBeDefined();
        done();
      });

      // Simulate sync completion & advance timers
      getLastSync.mockResolvedValue(new Date("2024-05-15"));
      jest.advanceTimersByTime(201);
    });
  });

  describe("product separation", () => {
    describe("Password Manager", () => {
      it("is always included", async () => {
        initiateService();

        const products = await firstValueFrom(service.products$);

        expect(products.bento.find((p) => p.name === "Password Manager")).toBeDefined();
      });
    });

    describe("Secret Manager", () => {
      it("is included in other when there are no organizations with SM", async () => {
        initiateService();

        const products = await firstValueFrom(service.products$);

        expect(products.other.find((p) => p.name === "Secrets Manager")).toBeDefined();
      });

      it("is included in bento when there is an organization with SM", async () => {
        organizationService.organizations$ = of([
          {
            id: "1234",
            canAccessSecretsManager: true,
            enabled: true,
            canAccessExport: (_) => true,
          },
        ] as Organization[]);

        initiateService();

        const products = await firstValueFrom(service.products$);

        expect(products.bento.find((p) => p.name === "Secrets Manager")).toBeDefined();
      });
    });

    describe("Admin/Organizations", () => {
      it("includes Organizations in other when there are organizations", async () => {
        initiateService();

        const products = await firstValueFrom(service.products$);

        expect(products.other.find((p) => p.name === "Organizations")).toBeDefined();
        expect(products.bento.find((p) => p.name === "Admin Console")).toBeUndefined();
      });

      it("includes Admin Console in bento when a user has access to it", async () => {
        organizationService.organizations$ = of([{ id: "1234", isOwner: true }] as Organization[]);

        initiateService();

        const products = await firstValueFrom(service.products$);

        expect(products.bento.find((p) => p.name === "Admin Console")).toBeDefined();
        expect(products.other.find((p) => p.name === "Organizations")).toBeUndefined();
      });
    });

    describe("Provider Portal", () => {
      it("is not included when there are no providers", async () => {
        initiateService();
        const products = await firstValueFrom(service.products$);

        expect(products.bento.find((p) => p.name === "Provider Portal")).toBeUndefined();
        expect(products.other.find((p) => p.name === "Provider Portal")).toBeUndefined();
      });

      it("is included when there are providers", async () => {
        providerService.getAll.mockResolvedValue([{ id: "67899" }] as Provider[]);

        initiateService();

        const products = await firstValueFrom(service.products$);

        expect(products.bento.find((p) => p.name === "Provider Portal")).toBeDefined();
      });
    });
  });

  describe("active product", () => {
    it("marks Password Manager as active", async () => {
      initiateService();

      const products = await firstValueFrom(service.products$);

      const { isActive } = products.bento.find((p) => p.name === "Password Manager");

      expect(isActive).toBe(true);
    });

    it("marks Secret Manager as active", async () => {
      router.url = "/sm/";

      initiateService();

      const products = await firstValueFrom(service.products$);

      const { isActive } = products.other.find((p) => p.name === "Secrets Manager");

      expect(isActive).toBe(true);
    });

    it("marks Admin Console as active", async () => {
      organizationService.organizations$ = of([{ id: "1234", isOwner: true }] as Organization[]);
      activeRouteParams = convertToParamMap({ organizationId: "1" });
      router.url = "/organizations/";

      initiateService();

      const products = await firstValueFrom(service.products$);

      const { isActive } = products.bento.find((p) => p.name === "Admin Console");

      expect(isActive).toBe(true);
    });

    it("marks Provider Portal as active", async () => {
      providerService.getAll.mockResolvedValue([{ id: "67899" }] as Provider[]);
      router.url = "/providers/";

      initiateService();

      const products = await firstValueFrom(service.products$);

      const { isActive } = products.bento.find((p) => p.name === "Provider Portal");

      expect(isActive).toBe(true);
    });
  });

  describe("current org path", () => {
    it("updates secrets manager path when the org id is found in the path", async () => {
      router.url = "/sm/4243";

      organizationService.organizations$ = of([
        {
          id: "23443234",
          canAccessSecretsManager: true,
          enabled: true,
          name: "Org 2",
          canAccessExport: (_) => true,
        },
        {
          id: "4243",
          canAccessSecretsManager: true,
          enabled: true,
          name: "Org 32",
          canAccessExport: (_) => true,
        },
      ] as Organization[]);

      initiateService();

      const products = await firstValueFrom(service.products$);

      const { appRoute } = products.bento.find((p) => p.name === "Secrets Manager");

      expect(appRoute).toEqual(["/sm", "4243"]);
    });
  });

  it("updates admin console path when the org id is found in the path", async () => {
    router.url = "/organizations/111-22-33";

    organizationService.organizations$ = of([
      { id: "111-22-33", isOwner: true, name: "Test Org" },
      { id: "4243", isOwner: true, name: "My Org" },
    ] as Organization[]);

    initiateService();

    const products = await firstValueFrom(service.products$);

    const { appRoute } = products.bento.find((p) => p.name === "Admin Console");

    expect(appRoute).toEqual(["/organizations", "111-22-33"]);
  });
});
