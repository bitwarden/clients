import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { TaxIdWarningTypes } from "@bitwarden/web-vault/app/billing/warnings/types";

import {
  BillingAddressControls,
  EnterBillingAddressComponent,
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

  it("trims and uppercases the taxId value before resolving and submitting it", () => {
    const result = getBillingAddressFromControls(
      buildControls({ country: "CA", taxId: " 987654321 " }),
    );

    expect(result.taxId).toEqual({ code: "ca_bn", value: "987654321" });
  });

  it("resolves a lowercase taxId value to its matching type", () => {
    const result = getBillingAddressFromControls(
      buildControls({ country: "GB", taxId: "gb123456789" }),
    );

    expect(result.taxId).toEqual({ code: "gb_vat", value: "GB123456789" });
  });

  it("returns a null taxId when the taxId control is only whitespace", () => {
    const result = getBillingAddressFromControls(buildControls({ country: "CA", taxId: "   " }));

    expect(result.taxId).toBeNull();
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

describe("EnterBillingAddressComponent", () => {
  let component: EnterBillingAddressComponent;

  const i18nService = mock<I18nService>();
  i18nService.t.mockImplementation((key: string, ...args: unknown[]) => [key, ...args].join(":"));

  const setup = (scenario: EnterBillingAddressComponent["scenario"]) => {
    component = new EnterBillingAddressComponent(i18nService);
    component.scenario = scenario;
    component.group = EnterBillingAddressComponent.getFormGroup();
    component.ngOnInit();
  };

  const setCountry = (country: string) => component.group.controls.country.setValue(country);
  const setTaxId = (taxId: string) => component.group.controls.taxId.setValue(taxId);
  const hint = () => (component as any).taxIdHint as string | null;

  afterEach(() => {
    component?.ngOnDestroy();
  });

  it("shows the example up front for a single-format country", () => {
    setup({ type: "update", supportsTaxId: true });

    setCountry("FR");

    expect(hint()).toBe("taxIdFormatExample:FRAB123456789");
  });

  it("shows no hint for a multi-format country with no value", () => {
    setup({ type: "update", supportsTaxId: true });

    setCountry("CA");
    expect(hint()).toBeNull();

    setCountry("GB");
    expect(hint()).toBeNull();
  });

  it("reacts to the entered value for a multi-format country", () => {
    setup({ type: "update", supportsTaxId: true });
    setCountry("CA");

    setTaxId("987654321");
    expect(hint()).toBe("recognizedTaxIdFormat:Canadian Business Number");

    setTaxId("123456789RT0002");
    expect(hint()).toBe("recognizedTaxIdFormat:Canadian GST/HST number");

    setTaxId("12345");
    expect(hint()).toBeNull();
  });

  it("resolves United Kingdom values by the entered value", () => {
    setup({ type: "update", supportsTaxId: true });
    setCountry("GB");

    setTaxId("GB123456789");
    expect(hint()).toBe("recognizedTaxIdFormat:United Kingdom VAT number");

    setTaxId("XI123456789");
    expect(hint()).toBe("recognizedTaxIdFormat:Northern Ireland VAT number");
  });

  it("prefixes the failed-verification warning with the example", () => {
    setup({
      type: "update",
      supportsTaxId: true,
      taxIdWarning: TaxIdWarningTypes.FailedVerification,
    });
    setCountry("CA");
    setTaxId("987654321");

    expect((component as any).taxIdWarningActive).toBe(true);
    expect(hint()).toBe("checkInputFormat taxIdFormatExample:123456789");
  });

  it("shows the failed-verification prefix alone when there is no example", () => {
    setup({
      type: "update",
      supportsTaxId: true,
      taxIdWarning: TaxIdWarningTypes.FailedVerification,
    });

    setCountry("CA");

    expect(hint()).toBe("checkInputFormat");
  });

  it("shows guidance during checkout", () => {
    setup({ type: "checkout", supportsTaxId: true });

    setCountry("FR");

    expect((component as any).taxIdWarningActive).toBe(false);
    expect(hint()).toBe("taxIdFormatExample:FRAB123456789");
  });

  it("returns no hint when tax IDs are unsupported", () => {
    setup({ type: "update", supportsTaxId: false });

    setCountry("FR");

    expect(hint()).toBeNull();
  });

  it("resets the tax ID when switching to an unsupported country", () => {
    setup({ type: "update", supportsTaxId: true });
    setCountry("CA");
    setTaxId("987654321");

    setCountry("US");

    expect(component.group.controls.taxId.value).toBeNull();
    expect(component.group.controls.taxId.disabled).toBe(true);
  });

  it("does not submit a stale tax ID after switching to an unsupported country", () => {
    setup({ type: "update", supportsTaxId: true });
    setCountry("CA");
    setTaxId("987654321");

    setCountry("US");

    expect(getBillingAddressFromControls(component.group.getRawValue()).taxId).toBeNull();
  });

  it("preserves the tax ID when switching between supported countries", () => {
    setup({ type: "update", supportsTaxId: true });
    setCountry("CA");
    setTaxId("987654321");

    setCountry("GB");

    expect(component.group.controls.taxId.value).toBe("987654321");
  });

  it("re-enables the tax ID when returning to a supported country", () => {
    setup({ type: "update", supportsTaxId: true });
    setCountry("CA");
    setCountry("US");
    setCountry("CA");

    expect(component.group.controls.taxId.enabled).toBe(true);
  });

  it("returns no hint for the United States", () => {
    setup({ type: "update", supportsTaxId: true });

    setCountry("US");

    expect(hint()).toBeNull();
  });

  it("shows no stale hint after switching from an unsupported country to a supported one", () => {
    setup({ type: "update", supportsTaxId: true });

    setCountry("US");
    setCountry("CA");

    expect(hint()).toBeNull();
  });

  it("does not clear an existing tax ID on open when the country can't enter one", () => {
    setup({
      type: "update",
      supportsTaxId: true,
      existing: {
        country: "US",
        postalCode: "12345",
        line1: null,
        line2: null,
        city: null,
        state: null,
        taxId: { code: "us_ein", value: "12-3456789" },
      },
    });

    expect(component.group.controls.taxId.value).toBe("12-3456789");
    expect(getBillingAddressFromControls(component.group.getRawValue()).taxId).toEqual({
      code: "us_ein",
      value: "12-3456789",
    });
  });
});
