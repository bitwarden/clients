import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, ParamMap } from "@angular/router";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { CollectionId } from "@bitwarden/common/types/guid";

import { RoutedVaultFilterModel } from "../models/routed-vault-filter.model";

import { RoutedVaultFilterService } from "./routed-vault-filter.service";
import { Vfo1TerminologyService } from "./vfo1-terminology.service";

describe("RoutedVaultFilterService", () => {
  function setup(flagEnabled: boolean, queryParams: Record<string, string> = {}) {
    const paramMap = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    const queryParamMap = new BehaviorSubject<ParamMap>(convertToParamMap(queryParams));

    TestBed.configureTestingModule({
      providers: [
        RoutedVaultFilterService,
        { provide: ActivatedRoute, useValue: { paramMap, queryParamMap } },
        { provide: Vfo1TerminologyService, useValue: { enabled: () => flagEnabled } },
      ],
    });

    return TestBed.inject(RoutedVaultFilterService);
  }

  describe("filter$ reader", () => {
    it("reads the collection from the legacy collectionId query param", async () => {
      const service = setup(false, { collectionId: "col-legacy" });

      const filter = await firstValueFrom(service.filter$);

      expect(filter.collectionId).toBe("col-legacy");
    });

    it("reads the collection from the new sharedFolderId query param", async () => {
      const service = setup(true, { sharedFolderId: "col-new" });

      const filter = await firstValueFrom(service.filter$);

      expect(filter.collectionId).toBe("col-new");
    });

    it("prefers sharedFolderId over collectionId when both are present", async () => {
      const service = setup(true, { sharedFolderId: "col-new", collectionId: "col-legacy" });

      const filter = await firstValueFrom(service.filter$);

      expect(filter.collectionId).toBe("col-new");
    });

    it("leaves the collection undefined when neither param is present", async () => {
      const service = setup(false, {});

      const filter = await firstValueFrom(service.filter$);

      expect(filter.collectionId).toBeUndefined();
    });
  });

  describe("createRoute writer", () => {
    const filter: RoutedVaultFilterModel = { collectionId: "col-1" as CollectionId };

    it("writes collectionId and clears sharedFolderId when the flag is off", () => {
      const service = setup(false);

      const [, extras] = service.createRoute(filter);

      expect(extras?.queryParams).toMatchObject({
        collectionId: "col-1",
        sharedFolderId: null,
      });
    });

    it("writes sharedFolderId and clears collectionId when the flag is on", () => {
      const service = setup(true);

      const [, extras] = service.createRoute(filter);

      expect(extras?.queryParams).toMatchObject({
        collectionId: null,
        sharedFolderId: "col-1",
      });
    });

    it("merges query params so unrelated params are preserved", () => {
      const service = setup(true);

      const [, extras] = service.createRoute(filter);

      expect(extras?.queryParamsHandling).toBe("merge");
    });
  });
});
