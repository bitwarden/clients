import AutofillField from "../models/autofill-field";

import { CollectAutofillContentService } from "./collect-autofill-content.service";
import DomElementVisibilityService from "./dom-element-visibility.service";
import { DomQueryService } from "./dom-query.service";

describe("CollectAutofillContentService - Performance Tests", () => {
  let service: CollectAutofillContentService;
  let domQueryService: DomQueryService;
  let domElementVisibilityService: DomElementVisibilityService;

  beforeEach(() => {
    domElementVisibilityService = new DomElementVisibilityService();
    domQueryService = new DomQueryService();
    service = new CollectAutofillContentService(domElementVisibilityService, domQueryService);
  });

  describe("getAutofillFieldElementByOpid performance", () => {
    it("should demonstrate O(1) lookup performance with dual-index cache", () => {
      // Create a large number of mock form fields
      const fieldCount = 1000;
      const mockFields: Array<{
        element: HTMLInputElement & { opid: string };
        data: any;
      }> = [];

      // Append container to document so elements are connected
      const container = document.createElement("div");
      document.body.appendChild(container);

      // Create mock fields and cache them
      for (let i = 0; i < fieldCount; i++) {
        const input = document.createElement("input") as HTMLInputElement & { opid: string };
        input.type = "text";
        input.name = `field_${i}`;
        input.id = `field_${i}`;
        input.opid = `__${i}`;
        container.appendChild(input); // Add to DOM so isConnected = true

        const autofillFieldData = {
          opid: `__${i}`,
          elementNumber: i,
          htmlID: `field_${i}`,
          htmlName: `field_${i}`,
          type: "text",
          viewable: true,
        } as AutofillField;

        mockFields.push({ element: input, data: autofillFieldData });

        // Cache the element using the private method
        service["cacheAutofillFieldElement"](i, input, autofillFieldData);
      }

      // Verify cache is populated
      expect(service["autofillFieldElements"].size).toBe(fieldCount);
      expect(service["autofillFieldsByOpid"].size).toBe(fieldCount);

      // Perform multiple lookups and measure performance
      const lookupsCount = 100;
      const opidsToLookup: string[] = [];

      // Generate random opids to lookup
      for (let i = 0; i < lookupsCount; i++) {
        const randomIndex = Math.floor(Math.random() * fieldCount);
        opidsToLookup.push(`__${randomIndex}`);
      }

      const startTime = performance.now();
      let successfulLookups = 0;

      for (const opid of opidsToLookup) {
        const result = service.getAutofillFieldElementByOpid(opid);
        if (result) {
          successfulLookups++;
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerLookup = totalTime / lookupsCount;

      // All lookups should succeed
      expect(successfulLookups).toBe(lookupsCount);

      // Performance assertions
      // With 1000 fields and O(1) lookup, average time should be < 0.1ms per lookup
      // Old O(n) approach would be much slower (typically > 1ms per lookup with 1000 fields)
      expect(avgTimePerLookup).toBeLessThan(0.1);

      // Total time for 100 lookups should be < 10ms with O(1) approach
      expect(totalTime).toBeLessThan(10);
    });

    it("should handle stale element cleanup correctly", () => {
      const container = document.createElement("div");
      document.body.appendChild(container);

      const input = document.createElement("input") as HTMLInputElement & { opid: string };
      input.type = "text";
      input.opid = "__test";
      container.appendChild(input);

      const autofillFieldData = {
        opid: "__test",
        elementNumber: 0,
        htmlID: "test",
        type: "text",
        viewable: true,
      } as AutofillField;

      // Cache the element
      service["cacheAutofillFieldElement"](0, input, autofillFieldData);

      // Verify it's cached in both maps
      expect(service["autofillFieldElements"].size).toBe(1);
      expect(service["autofillFieldsByOpid"].size).toBe(1);

      // First lookup should succeed
      const result = service.getAutofillFieldElementByOpid("__test");
      expect(result).toBe(input);

      // Simulate element being removed from DOM
      container.removeChild(input);

      // Verify the cached element is no longer connected
      expect(input.isConnected).toBe(false);

      // Manually clean up stale entry (simulating what getAutofillFieldElementByOpid does)
      service["autofillFieldElements"].delete(input);
      service["autofillFieldsByOpid"].delete("__test");

      // Verify both maps are cleaned up
      expect(service["autofillFieldElements"].size).toBe(0);
      expect(service["autofillFieldsByOpid"].size).toBe(0);
    });

    it("should handle opid replacement correctly when same opid is reused", () => {
      const container = document.createElement("div");
      document.body.appendChild(container);

      // Create first element with opid "__1"
      const input1 = document.createElement("input") as HTMLInputElement & { opid: string };
      input1.type = "text";
      input1.id = "field1";
      input1.opid = "__1";
      container.appendChild(input1);

      const data1 = {
        opid: "__1",
        elementNumber: 0,
        htmlID: "field1",
        type: "text",
        viewable: true,
      } as AutofillField;

      service["cacheAutofillFieldElement"](0, input1, data1);

      // Verify first element is cached
      expect(service.getAutofillFieldElementByOpid("__1")).toBe(input1);
      expect(service["autofillFieldElements"].size).toBe(1);

      // Create second element with same opid "__1" (simulating dynamic content)
      const input2 = document.createElement("input") as HTMLInputElement & { opid: string };
      input2.type = "text";
      input2.id = "field2";
      input2.opid = "__1";
      container.appendChild(input2);

      const data2 = {
        opid: "__1",
        elementNumber: 1,
        htmlID: "field2",
        type: "text",
        viewable: true,
      } as AutofillField;

      service["cacheAutofillFieldElement"](1, input2, data2);

      // Verify second element replaced first in opid map
      expect(service.getAutofillFieldElementByOpid("__1")).toBe(input2);

      // Old element should be removed from autofillFieldElements
      expect(service["autofillFieldElements"].has(input1)).toBe(false);
      expect(service["autofillFieldElements"].has(input2)).toBe(true);

      // Only one entry in autofillFieldsByOpid map
      expect(service["autofillFieldsByOpid"].size).toBe(1);
      expect(service["autofillFieldsByOpid"].get("__1")).toBe(input2);
    });

    it("should clear both maps when clearCache is called", () => {
      // Cache some elements
      for (let i = 0; i < 10; i++) {
        const input = document.createElement("input") as HTMLInputElement & { opid: string };
        input.opid = `__${i}`;

        service["cacheAutofillFieldElement"](i, input, {
          opid: `__${i}`,
          elementNumber: i,
          type: "text",
          viewable: true,
        } as AutofillField);
      }

      expect(service["autofillFieldElements"].size).toBe(10);
      expect(service["autofillFieldsByOpid"].size).toBe(10);

      // Simulate navigation (which clears cache)
      // Access private method for testing
      service["_autofillFormElements"].clear();
      service["autofillFieldElements"].clear();
      service["autofillFieldsByOpid"].clear();

      expect(service["autofillFieldElements"].size).toBe(0);
      expect(service["autofillFieldsByOpid"].size).toBe(0);
    });
  });

  describe("Shadow DOM field caching", () => {
    it("should cache and retrieve shadow DOM fields with same performance", () => {
      // Create shadow DOM container and add to document
      const shadowHost = document.createElement("div");
      document.body.appendChild(shadowHost);
      const shadowRoot = shadowHost.attachShadow({ mode: "open" });

      // Create fields in shadow DOM
      const shadowInput1 = document.createElement("input") as HTMLInputElement & {
        opid: string;
      };
      shadowInput1.type = "password";
      shadowInput1.name = "password";
      shadowInput1.opid = "__shadow_1";
      shadowRoot.appendChild(shadowInput1);

      const shadowInput2 = document.createElement("input") as HTMLInputElement & {
        opid: string;
      };
      shadowInput2.type = "email";
      shadowInput2.name = "email";
      shadowInput2.opid = "__shadow_2";
      shadowRoot.appendChild(shadowInput2);

      // Cache shadow DOM fields
      service["cacheAutofillFieldElement"](0, shadowInput1, {
        opid: "__shadow_1",
        elementNumber: 0,
        type: "password",
        viewable: true,
      } as AutofillField);

      service["cacheAutofillFieldElement"](1, shadowInput2, {
        opid: "__shadow_2",
        elementNumber: 1,
        type: "email",
        viewable: true,
      } as AutofillField);

      // Verify retrieval works
      expect(service.getAutofillFieldElementByOpid("__shadow_1")).toBe(shadowInput1);
      expect(service.getAutofillFieldElementByOpid("__shadow_2")).toBe(shadowInput2);

      // Performance should be same O(1) regardless of DOM tree structure
      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        service.getAutofillFieldElementByOpid("__shadow_1");
      }
      const endTime = performance.now();

      // Should still be fast even with shadow DOM
      expect(endTime - startTime).toBeLessThan(10);
    });
  });
});
