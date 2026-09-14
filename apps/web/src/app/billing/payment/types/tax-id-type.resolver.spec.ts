import {
  findTaxIdTypeByValue,
  getTaxIdTypeForCountry,
  normalizeTaxIdValue,
  taxIdTypes,
} from "./tax-id-type";

describe("getTaxIdTypeForCountry", () => {
  describe("value-aware resolution", () => {
    it("resolves Canadian values to the matching type", () => {
      expect(getTaxIdTypeForCountry("CA", "987654321")?.code).toBe("ca_bn");
      expect(getTaxIdTypeForCountry("CA", "123456789RT0002")?.code).toBe("ca_gst_hst");
      expect(getTaxIdTypeForCountry("CA", "1234567890TQ1234")?.code).toBe("ca_qst");
      expect(getTaxIdTypeForCountry("CA", "PST-1234-5678")?.code).toBe("ca_pst_bc");
      expect(getTaxIdTypeForCountry("CA", "123456-7")?.code).toBe("ca_pst_mb");
      expect(getTaxIdTypeForCountry("CA", "1234567")?.code).toBe("ca_pst_sk");
    });

    it("resolves United Kingdom values to the matching type", () => {
      expect(getTaxIdTypeForCountry("GB", "XI123456789")?.code).toBe("eu_vat");
      expect(getTaxIdTypeForCountry("GB", "GB123456789")?.code).toBe("gb_vat");
      expect(getTaxIdTypeForCountry("GB", "123456789")?.code).toBe("gb_vat");
    });

    it("resolves Spanish values to the matching type", () => {
      expect(getTaxIdTypeForCountry("ES", "A12345678")?.code).toBe("es_cif");
      expect(getTaxIdTypeForCountry("ES", "ESA1234567Z")?.code).toBe("eu_vat");
    });

    it("resolves German values to the matching type", () => {
      expect(getTaxIdTypeForCountry("DE", "DE123456789")?.code).toBe("eu_vat");
      expect(getTaxIdTypeForCountry("DE", "1234567890")?.code).toBe("de_stn");
    });
  });

  describe("value normalization", () => {
    it("resolves a value with surrounding whitespace", () => {
      expect(getTaxIdTypeForCountry("CA", " 987654321 ")?.code).toBe("ca_bn");
    });

    it("resolves a value regardless of case", () => {
      expect(getTaxIdTypeForCountry("GB", "gb123456789")?.code).toBe("gb_vat");
      expect(getTaxIdTypeForCountry("GB", "xi123456789")?.code).toBe("eu_vat");
    });

    it("resolves a value with mixed whitespace and case", () => {
      expect(getTaxIdTypeForCountry("GB", " gb123456789 ")?.code).toBe("gb_vat");
    });

    it("resolves a value with internal whitespace", () => {
      expect(getTaxIdTypeForCountry("GB", "GB 123456789")?.code).toBe("gb_vat");
    });
  });

  describe("separator characters are literal", () => {
    const brazil = taxIdTypes.filter((type) => type.iso === "BR");
    const switzerland = taxIdTypes.filter((type) => type.iso === "CH");

    it("does not treat an arbitrary character as a Brazilian CPF separator", () => {
      expect(findTaxIdTypeByValue(brazil, "123X456X789-87")).toBeUndefined();
    });

    it("does not treat an arbitrary character as a Swiss VAT separator", () => {
      expect(findTaxIdTypeByValue(switzerland, "CHE-123X456X789MWST")).toBeUndefined();
    });
  });

  describe("Brazil declaration order", () => {
    it("resolves a CPF-shaped value to br_cpf", () => {
      expect(getTaxIdTypeForCountry("BR", "123.456.789-87")?.code).toBe("br_cpf");
    });

    it("resolves a CNPJ-shaped value to br_cnpj", () => {
      expect(getTaxIdTypeForCountry("BR", "01.234.456/5432-10")?.code).toBe("br_cnpj");
    });

    it("resolves a bare 14-digit value to br_cnpj", () => {
      expect(getTaxIdTypeForCountry("BR", "12345678901234")?.code).toBe("br_cnpj");
    });
  });

  describe("fallbacks and edge cases", () => {
    it("returns the sole type for a single-entry country regardless of value", () => {
      expect(getTaxIdTypeForCountry("FR", "anything")?.code).toBe("eu_vat");
      expect(getTaxIdTypeForCountry("FR")?.code).toBe("eu_vat");
    });

    it("returns null for an unknown country", () => {
      expect(getTaxIdTypeForCountry("ZZ")).toBeNull();
      expect(getTaxIdTypeForCountry("ZZ", "123456789")).toBeNull();
    });

    it("falls back to the tax-impacting type when no value is provided", () => {
      expect(getTaxIdTypeForCountry("CA")?.code).toBe("ca_gst_hst");
      expect(getTaxIdTypeForCountry("GB")?.code).toBe("eu_vat");
      expect(getTaxIdTypeForCountry("ES")?.code).toBe("eu_vat");
    });

    it("falls back to the tax-impacting type when the value is empty", () => {
      expect(getTaxIdTypeForCountry("CA", "")?.code).toBe("ca_gst_hst");
      expect(getTaxIdTypeForCountry("GB", "")?.code).toBe("eu_vat");
      expect(getTaxIdTypeForCountry("ES", "")?.code).toBe("eu_vat");
    });

    it("falls back to the tax-impacting type when the value matches nothing", () => {
      expect(getTaxIdTypeForCountry("CA", "not-a-tax-id")?.code).toBe("ca_gst_hst");
      expect(getTaxIdTypeForCountry("GB", "not-a-tax-id")?.code).toBe("eu_vat");
      expect(getTaxIdTypeForCountry("ES", "not-a-tax-id")?.code).toBe("eu_vat");
    });

    it("falls back to the tax-impacting type on a near-miss value", () => {
      expect(getTaxIdTypeForCountry("CA", "12345678")?.code).toBe("ca_gst_hst");
    });

    it("falls back to the first entry when no entry impacts tax calculation", () => {
      expect(getTaxIdTypeForCountry("BR")?.code).toBe("br_cnpj");
      expect(getTaxIdTypeForCountry("BR", "not-a-tax-id")?.code).toBe("br_cnpj");
    });
  });

  describe("format coverage", () => {
    const countsByIso = taxIdTypes.reduce<Record<string, number>>((counts, type) => {
      counts[type.iso] = (counts[type.iso] ?? 0) + 1;
      return counts;
    }, {});
    const multiEntryTypes = taxIdTypes.filter((type) => countsByIso[type.iso] > 1);

    it("defines format on every entry of a multi-entry country", () => {
      expect(multiEntryTypes.length).toBeGreaterThan(0);
      multiEntryTypes.forEach((type) => {
        expect(type.format).toBeDefined();
      });
    });

    it("resolves every multi-entry example back to its own type", () => {
      expect(multiEntryTypes.length).toBeGreaterThan(0);
      multiEntryTypes.forEach((type) => {
        expect(getTaxIdTypeForCountry(type.iso, type.example)?.code).toBe(type.code);
      });
    });

    it("matches every entry's own example against its format", () => {
      const typesWithFormat = taxIdTypes.filter((type) => type.format);

      expect(typesWithFormat.length).toBeGreaterThan(0);
      taxIdTypes.forEach((type) => {
        if (type.format) {
          expect(type.format.test(type.example)).toBe(true);
        }
      });
    });
  });
});

describe("normalizeTaxIdValue", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeTaxIdValue(" 987654321 ")).toBe("987654321");
  });

  it("removes internal whitespace", () => {
    expect(normalizeTaxIdValue("GB 123 456 789")).toBe("GB123456789");
  });

  it("converts to uppercase", () => {
    expect(normalizeTaxIdValue("gb123456789")).toBe("GB123456789");
  });

  it("reduces a whitespace-only value to an empty string", () => {
    expect(normalizeTaxIdValue("   ")).toBe("");
  });
});
