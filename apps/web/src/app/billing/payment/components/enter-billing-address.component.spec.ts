import {
  BillingAddressControls,
  getBillingAddressFromControls,
} from "./enter-billing-address.component";

describe("getBillingAddressFromControls", () => {
  const buildControls = (
    overrides: Partial<BillingAddressControls> = {},
  ): BillingAddressControls => ({
    country: "US",
    postalCode: "10001",
    line1: "123 Main St",
    line2: "Apt 4B",
    city: "New York",
    state: "NY",
    taxId: null,
    ...overrides,
  });

  it("resolves a Canadian value against the entered value rather than the country default", () => {
    const result = getBillingAddressFromControls(
      buildControls({ country: "CA", taxId: "987654321" }),
    );

    expect(result.taxId).toEqual({ code: "ca_bn", value: "987654321" });
  });

  it("resolves Canadian GST/HST and QST values to their matching types", () => {
    expect(
      getBillingAddressFromControls(buildControls({ country: "CA", taxId: "123456789RT0002" }))
        .taxId?.code,
    ).toBe("ca_gst_hst");
    expect(
      getBillingAddressFromControls(buildControls({ country: "CA", taxId: "1234567890TQ1234" }))
        .taxId?.code,
    ).toBe("ca_qst");
  });

  it("resolves United Kingdom values to their matching types", () => {
    expect(
      getBillingAddressFromControls(buildControls({ country: "GB", taxId: "GB123456789" })).taxId
        ?.code,
    ).toBe("gb_vat");
    expect(
      getBillingAddressFromControls(buildControls({ country: "GB", taxId: "XI123456789" })).taxId
        ?.code,
    ).toBe("eu_vat");
  });

  it("returns a null taxId when the taxId control is null", () => {
    const result = getBillingAddressFromControls(buildControls({ country: "CA", taxId: null }));

    expect(result.taxId).toBeNull();
  });

  it("returns a null taxId when the taxId control is an empty string", () => {
    const result = getBillingAddressFromControls(buildControls({ country: "CA", taxId: "" }));

    expect(result.taxId).toBeNull();
  });

  it("returns a null taxId when the country has no tax ID types", () => {
    const result = getBillingAddressFromControls(
      buildControls({ country: "ZZ", taxId: "123456789" }),
    );

    expect(result.taxId).toBeNull();
  });

  it("passes the address fields through unchanged and replaces the raw taxId string", () => {
    const controls = buildControls({ country: "CA", taxId: "987654321" });

    const result = getBillingAddressFromControls(controls);

    expect(result.country).toBe(controls.country);
    expect(result.postalCode).toBe(controls.postalCode);
    expect(result.line1).toBe(controls.line1);
    expect(result.line2).toBe(controls.line2);
    expect(result.city).toBe(controls.city);
    expect(result.state).toBe(controls.state);
    expect(result.taxId).toEqual({ code: "ca_bn", value: "987654321" });
  });
});
