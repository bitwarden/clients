import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BankAccount } from "@bitwarden/common/billing/models/domain";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { StripeService } from "./stripe.service";

// Extend Window interface to include Stripe
declare global {
  interface Window {
    Stripe: any;
  }
}

describe("StripeService", () => {
  let service: StripeService;
  let apiService: MockProxy<ApiService>;
  let logService: MockProxy<LogService>;

  // Stripe SDK mocks
  let mockStripeInstance: any;
  let mockElements: any;
  let mockCardNumber: any;
  let mockCardExpiry: any;
  let mockCardCvc: any;

  // DOM mocks
  let mockScript: HTMLScriptElement;
  let mockIframe: HTMLIFrameElement;

  beforeEach(() => {
    jest.useFakeTimers();

    // Setup service dependency mocks
    apiService = mock<ApiService>();
    logService = mock<LogService>();

    // Setup Stripe element mocks
    mockCardNumber = {
      mount: jest.fn(),
      unmount: jest.fn(),
    };
    mockCardExpiry = {
      mount: jest.fn(),
      unmount: jest.fn(),
    };
    mockCardCvc = {
      mount: jest.fn(),
      unmount: jest.fn(),
    };

    // Setup Stripe Elements mock
    mockElements = {
      create: jest.fn((type: string) => {
        switch (type) {
          case "cardNumber":
            return mockCardNumber;
          case "cardExpiry":
            return mockCardExpiry;
          case "cardCvc":
            return mockCardCvc;
          default:
            return null;
        }
      }),
      getElement: jest.fn((type: string) => {
        switch (type) {
          case "cardNumber":
            return mockCardNumber;
          case "cardExpiry":
            return mockCardExpiry;
          case "cardCvc":
            return mockCardCvc;
          default:
            return null;
        }
      }),
    };

    // Setup Stripe instance mock
    mockStripeInstance = {
      elements: jest.fn(() => mockElements),
      confirmCardSetup: jest.fn(),
      confirmUsBankAccountSetup: jest.fn(),
    };

    // Setup window.Stripe mock
    window.Stripe = jest.fn(() => mockStripeInstance);

    // Setup DOM mocks
    mockScript = {
      id: "",
      src: "",
      onload: null,
      onerror: null,
    } as any;

    mockIframe = {
      src: "https://js.stripe.com/v3/",
      remove: jest.fn(),
    } as any;

    jest.spyOn(window.document, "createElement").mockReturnValue(mockScript);
    jest.spyOn(window.document, "getElementById").mockReturnValue(null);
    jest.spyOn(window.document.head, "appendChild").mockReturnValue(mockScript);
    jest.spyOn(window.document.head, "removeChild").mockImplementation(() => mockScript);
    jest.spyOn(window.document, "querySelectorAll").mockReturnValue([mockIframe] as any);

    // Mock getComputedStyle
    jest.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: (prop: string) => {
        const props: Record<string, string> = {
          "--color-text-main": "0, 0, 0",
          "--color-text-muted": "128, 128, 128",
          "--color-danger-600": "220, 38, 38",
        };
        return props[prop] || "";
      },
    } as any);

    // Create service instance
    service = new StripeService(apiService, logService);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // Helper function to trigger script load
  const triggerScriptLoad = () => {
    if (mockScript.onload) {
      mockScript.onload(new Event("load"));
    }
  };

  // Helper function to advance timers and flush promises
  const advanceTimersAndFlush = async (ms: number) => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  };

  describe("createSetupIntent", () => {
    it("should call API with correct path for card payment", async () => {
      apiService.send.mockResolvedValue("client_secret_card_123");

      const result = await service.createSetupIntent("card");

      expect(apiService.send).toHaveBeenCalledWith("POST", "/setup-intent/card", null, true, true);
      expect(result).toBe("client_secret_card_123");
    });

    it("should call API with correct path for bank account payment", async () => {
      apiService.send.mockResolvedValue("client_secret_bank_456");

      const result = await service.createSetupIntent("bankAccount");

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/setup-intent/bank-account",
        null,
        true,
        true,
      );
      expect(result).toBe("client_secret_bank_456");
    });

    it("should return client secret from API response", async () => {
      const expectedSecret = "seti_1234567890_secret_abcdefg";
      apiService.send.mockResolvedValue(expectedSecret);

      const result = await service.createSetupIntent("card");

      expect(result).toBe(expectedSecret);
    });

    it("should propagate API errors", async () => {
      const error = new Error("API error");
      apiService.send.mockRejectedValue(error);

      await expect(service.createSetupIntent("card")).rejects.toThrow("API error");
    });
  });

  describe("loadStripe - initial load", () => {
    const instanceId = "test-instance-1";
    const elementIds = {
      cardNumber: "#card-number",
      cardExpiry: "#card-expiry",
      cardCvc: "#card-cvc",
    };

    it("should create script element with correct attributes", () => {
      service.loadStripe(instanceId, elementIds, false);

      expect(window.document.createElement).toHaveBeenCalledWith("script");
      expect(mockScript.id).toBe("stripe-script");
      expect(mockScript.src).toBe("https://js.stripe.com/v3?advancedFraudSignals=false");
    });

    it("should append script to document head", () => {
      service.loadStripe(instanceId, elementIds, false);

      expect(window.document.head.appendChild).toHaveBeenCalledWith(mockScript);
    });

    it("should initialize Stripe client on script load", async () => {
      service.loadStripe(instanceId, elementIds, false);

      triggerScriptLoad();
      await advanceTimersAndFlush(0);

      expect(window.Stripe).toHaveBeenCalledWith(process.env.STRIPE_KEY);
    });

    it("should create Elements instance and store in Map", async () => {
      service.loadStripe(instanceId, elementIds, false);

      triggerScriptLoad();
      await advanceTimersAndFlush(50);

      expect(mockStripeInstance.elements).toHaveBeenCalled();
      expect(service["instances"].size).toBe(1);
      expect(service["instances"].get(instanceId)).toBeDefined();
    });

    it("should increment instanceCount", async () => {
      service.loadStripe(instanceId, elementIds, false);

      triggerScriptLoad();
      await advanceTimersAndFlush(50);

      expect(service["instanceCount"]).toBe(1);
    });
  });

  describe("loadStripe - already loaded", () => {
    const instanceId1 = "instance-1";
    const instanceId2 = "instance-2";
    const elementIds = {
      cardNumber: "#card-number",
      cardExpiry: "#card-expiry",
      cardCvc: "#card-cvc",
    };

    beforeEach(async () => {
      // Load first instance to initialize Stripe
      service.loadStripe(instanceId1, elementIds, false);
      triggerScriptLoad();
      await advanceTimersAndFlush(100);
    });

    it("should not create new script if already loaded", () => {
      jest.clearAllMocks();

      service.loadStripe(instanceId2, elementIds, false);

      expect(window.document.createElement).not.toHaveBeenCalled();
      expect(window.document.head.appendChild).not.toHaveBeenCalled();
    });

    it("should immediately initialize instance when script loaded", async () => {
      service.loadStripe(instanceId2, elementIds, false);
      await advanceTimersAndFlush(50);

      expect(service["instances"].size).toBe(2);
      expect(service["instances"].get(instanceId2)).toBeDefined();
    });

    it("should increment instanceCount correctly", async () => {
      expect(service["instanceCount"]).toBe(1);

      service.loadStripe(instanceId2, elementIds, false);
      await advanceTimersAndFlush(50);

      expect(service["instanceCount"]).toBe(2);
    });
  });

  describe("loadStripe - concurrent calls", () => {
    const elementIds = {
      cardNumber: "#card-number",
      cardExpiry: "#card-expiry",
      cardCvc: "#card-cvc",
    };

    it("should handle multiple loadStripe calls sequentially", async () => {
      // Test practical scenario: load instances one after another
      service.loadStripe("instance-1", elementIds, false);
      triggerScriptLoad();
      await advanceTimersAndFlush(100);

      service.loadStripe("instance-2", elementIds, false);
      await advanceTimersAndFlush(100);

      service.loadStripe("instance-3", elementIds, false);
      await advanceTimersAndFlush(100);

      // All instances should be initialized
      expect(service["instances"].size).toBe(3);
      expect(service["instanceCount"]).toBe(3);
      expect(service["instances"].get("instance-1")).toBeDefined();
      expect(service["instances"].get("instance-2")).toBeDefined();
      expect(service["instances"].get("instance-3")).toBeDefined();
    });

    it("should share Stripe client across instances", async () => {
      // Load first instance
      service.loadStripe("instance-1", elementIds, false);
      triggerScriptLoad();
      await advanceTimersAndFlush(100);

      const stripeClientAfterFirst = service["stripe"];
      expect(stripeClientAfterFirst).toBeDefined();

      // Load second instance
      service.loadStripe("instance-2", elementIds, false);
      await advanceTimersAndFlush(100);

      // Should reuse the same Stripe client
      expect(service["stripe"]).toBe(stripeClientAfterFirst);
      expect(service["instances"].size).toBe(2);
    });
  });

  describe("mountElements - success path", () => {
    const instanceId = "mount-test-instance";
    const elementIds = {
      cardNumber: "#card-number-mount",
      cardExpiry: "#card-expiry-mount",
      cardCvc: "#card-cvc-mount",
    };

    beforeEach(async () => {
      service.loadStripe(instanceId, elementIds, false);
      triggerScriptLoad();
      await advanceTimersAndFlush(100);
    });

    it("should mount all three card elements to DOM", async () => {
      service.mountElements(instanceId);
      await advanceTimersAndFlush(100);

      expect(mockCardNumber.mount).toHaveBeenCalledWith("#card-number-mount");
      expect(mockCardExpiry.mount).toHaveBeenCalledWith("#card-expiry-mount");
      expect(mockCardCvc.mount).toHaveBeenCalledWith("#card-cvc-mount");
    });

    it("should use correct element IDs from instance", async () => {
      const customIds = {
        cardNumber: "#custom-card",
        cardExpiry: "#custom-expiry",
        cardCvc: "#custom-cvc",
      };

      service.loadStripe("custom-instance", customIds, false);
      await advanceTimersAndFlush(100);

      service.mountElements("custom-instance");
      await advanceTimersAndFlush(100);

      expect(mockCardNumber.mount).toHaveBeenCalledWith("#custom-card");
      expect(mockCardExpiry.mount).toHaveBeenCalledWith("#custom-expiry");
      expect(mockCardCvc.mount).toHaveBeenCalledWith("#custom-cvc");
    });

    it("should handle autoMount flag correctly", async () => {
      const autoMountId = "auto-mount-instance";
      jest.clearAllMocks();

      service.loadStripe(autoMountId, elementIds, true);
      triggerScriptLoad();
      await advanceTimersAndFlush(150);

      // Should auto-mount without explicit call
      expect(mockCardNumber.mount).toHaveBeenCalled();
      expect(mockCardExpiry.mount).toHaveBeenCalled();
      expect(mockCardCvc.mount).toHaveBeenCalled();
    });
  });

  describe("mountElements - retry logic", () => {
    const elementIds = {
      cardNumber: "#card-number",
      cardExpiry: "#card-expiry",
      cardCvc: "#card-cvc",
    };

    it("should retry if instance not found", async () => {
      service.mountElements("non-existent-instance");
      await advanceTimersAndFlush(100);

      expect(logService.warning).toHaveBeenCalledWith(
        expect.stringContaining("Stripe instance non-existent-instance not found"),
      );
    });

    it("should log error after 10 failed attempts", async () => {
      service.mountElements("non-existent-instance");

      for (let i = 0; i < 10; i++) {
        await advanceTimersAndFlush(100);
      }

      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("not found after 10 attempts"),
      );
    });

    it("should retry if elements not ready", async () => {
      const instanceId = "retry-elements-instance";
      service.loadStripe(instanceId, elementIds, false);
      triggerScriptLoad();
      await advanceTimersAndFlush(100);

      // Make elements temporarily unavailable
      mockElements.getElement.mockReturnValueOnce(null);
      mockElements.getElement.mockReturnValueOnce(null);
      mockElements.getElement.mockReturnValueOnce(null);

      service.mountElements(instanceId);
      await advanceTimersAndFlush(100);

      expect(logService.warning).toHaveBeenCalledWith(
        expect.stringContaining("Some Stripe card elements"),
      );
    });
  });

  describe("setupCardPaymentMethod", () => {
    const instanceId = "card-setup-instance";
    const clientSecret = "seti_card_secret_123";
    const elementIds = {
      cardNumber: "#card-number",
      cardExpiry: "#card-expiry",
      cardCvc: "#card-cvc",
    };

    beforeEach(async () => {
      service.loadStripe(instanceId, elementIds, false);
      triggerScriptLoad();
      await advanceTimersAndFlush(100);
    });

    it("should call Stripe confirmCardSetup with correct parameters", async () => {
      mockStripeInstance.confirmCardSetup.mockResolvedValue({
        setupIntent: { status: "succeeded", payment_method: "pm_card_123" },
      });

      await service.setupCardPaymentMethod(instanceId, clientSecret);

      expect(mockStripeInstance.confirmCardSetup).toHaveBeenCalledWith(clientSecret, {
        payment_method: {
          card: mockCardNumber,
        },
      });
    });

    it("should include billing details when provided", async () => {
      mockStripeInstance.confirmCardSetup.mockResolvedValue({
        setupIntent: { status: "succeeded", payment_method: "pm_card_123" },
      });

      const billingDetails = { country: "US", postalCode: "12345" };
      await service.setupCardPaymentMethod(instanceId, clientSecret, billingDetails);

      expect(mockStripeInstance.confirmCardSetup).toHaveBeenCalledWith(clientSecret, {
        payment_method: {
          card: mockCardNumber,
          billing_details: {
            address: {
              country: "US",
              postal_code: "12345",
            },
          },
        },
      });
    });

    it("should throw error if instance not found", async () => {
      await expect(service.setupCardPaymentMethod("non-existent", clientSecret)).rejects.toThrow(
        "Stripe instance non-existent not found",
      );
    });

    it("should throw error if setup fails", async () => {
      const error = { message: "Card declined" };
      mockStripeInstance.confirmCardSetup.mockResolvedValue({ error });

      await expect(service.setupCardPaymentMethod(instanceId, clientSecret)).rejects.toEqual(error);
      expect(logService.error).toHaveBeenCalledWith(error);
    });

    it("should throw error if status is not succeeded", async () => {
      const error = { message: "Invalid status" };
      mockStripeInstance.confirmCardSetup.mockResolvedValue({
        setupIntent: { status: "requires_action" },
        error,
      });

      await expect(service.setupCardPaymentMethod(instanceId, clientSecret)).rejects.toEqual(error);
    });

    it("should return payment method ID on success", async () => {
      mockStripeInstance.confirmCardSetup.mockResolvedValue({
        setupIntent: { status: "succeeded", payment_method: "pm_card_success_123" },
      });

      const result = await service.setupCardPaymentMethod(instanceId, clientSecret);

      expect(result).toBe("pm_card_success_123");
    });
  });

  describe("setupBankAccountPaymentMethod", () => {
    const clientSecret = "seti_bank_secret_456";
    const bankAccount: BankAccount = {
      accountHolderName: "John Doe",
      routingNumber: "110000000",
      accountNumber: "000123456789",
      accountHolderType: "individual",
    };

    beforeEach(async () => {
      // Initialize Stripe instance for bank account tests
      service.loadStripe(
        "bank-test-instance",
        {
          cardNumber: "#card",
          cardExpiry: "#expiry",
          cardCvc: "#cvc",
        },
        false,
      );
      triggerScriptLoad();
      await advanceTimersAndFlush(100);
    });

    it("should call Stripe confirmUsBankAccountSetup with bank details", async () => {
      mockStripeInstance.confirmUsBankAccountSetup.mockResolvedValue({
        setupIntent: { status: "requires_action", payment_method: "pm_bank_123" },
      });

      await service.setupBankAccountPaymentMethod(clientSecret, bankAccount);

      expect(mockStripeInstance.confirmUsBankAccountSetup).toHaveBeenCalledWith(clientSecret, {
        payment_method: {
          us_bank_account: {
            routing_number: "110000000",
            account_number: "000123456789",
            account_holder_type: "individual",
          },
          billing_details: {
            name: "John Doe",
          },
        },
      });
    });

    it("should include billing address when provided", async () => {
      mockStripeInstance.confirmUsBankAccountSetup.mockResolvedValue({
        setupIntent: { status: "requires_action", payment_method: "pm_bank_123" },
      });

      const billingDetails = { country: "US", postalCode: "90210" };
      await service.setupBankAccountPaymentMethod(clientSecret, bankAccount, billingDetails);

      expect(mockStripeInstance.confirmUsBankAccountSetup).toHaveBeenCalledWith(clientSecret, {
        payment_method: {
          us_bank_account: {
            routing_number: "110000000",
            account_number: "000123456789",
            account_holder_type: "individual",
          },
          billing_details: {
            name: "John Doe",
            address: {
              country: "US",
              postal_code: "90210",
            },
          },
        },
      });
    });

    it("should omit billing address when not provided", async () => {
      mockStripeInstance.confirmUsBankAccountSetup.mockResolvedValue({
        setupIntent: { status: "requires_action", payment_method: "pm_bank_123" },
      });

      await service.setupBankAccountPaymentMethod(clientSecret, bankAccount);

      const call = mockStripeInstance.confirmUsBankAccountSetup.mock.calls[0][1];
      expect(call.payment_method.billing_details.address).toBeUndefined();
    });

    it("should validate status is requires_action", async () => {
      const error = { message: "Invalid status" };
      mockStripeInstance.confirmUsBankAccountSetup.mockResolvedValue({
        setupIntent: { status: "succeeded" },
        error,
      });

      await expect(
        service.setupBankAccountPaymentMethod(clientSecret, bankAccount),
      ).rejects.toEqual(error);
    });

    it("should return payment method ID on success", async () => {
      mockStripeInstance.confirmUsBankAccountSetup.mockResolvedValue({
        setupIntent: { status: "requires_action", payment_method: "pm_bank_success_456" },
      });

      const result = await service.setupBankAccountPaymentMethod(clientSecret, bankAccount);

      expect(result).toBe("pm_bank_success_456");
    });
  });

  describe("unloadStripe - single instance", () => {
    const instanceId = "unload-test-instance";
    const elementIds = {
      cardNumber: "#card-number",
      cardExpiry: "#card-expiry",
      cardCvc: "#card-cvc",
    };

    beforeEach(async () => {
      service.loadStripe(instanceId, elementIds, false);
      triggerScriptLoad();
      await advanceTimersAndFlush(100);
    });

    it("should unmount all card elements", () => {
      service.unloadStripe(instanceId);

      expect(mockCardNumber.unmount).toHaveBeenCalled();
      expect(mockCardExpiry.unmount).toHaveBeenCalled();
      expect(mockCardCvc.unmount).toHaveBeenCalled();
    });

    it("should remove instance from Map", () => {
      expect(service["instances"].has(instanceId)).toBe(true);

      service.unloadStripe(instanceId);

      expect(service["instances"].has(instanceId)).toBe(false);
    });

    it("should decrement instanceCount", () => {
      expect(service["instanceCount"]).toBe(1);

      service.unloadStripe(instanceId);

      expect(service["instanceCount"]).toBe(0);
    });

    it("should remove script when last instance unloaded", () => {
      jest.spyOn(window.document, "getElementById").mockReturnValue(mockScript);

      service.unloadStripe(instanceId);

      expect(window.document.head.removeChild).toHaveBeenCalledWith(mockScript);
    });

    it("should remove Stripe iframes after cleanup delay", async () => {
      service.unloadStripe(instanceId);

      await advanceTimersAndFlush(500);

      expect(window.document.querySelectorAll).toHaveBeenCalledWith("iframe");
      expect(mockIframe.remove).toHaveBeenCalled();
    });
  });

  describe("unloadStripe - multiple instances", () => {
    const elementIds = {
      cardNumber: "#card-number",
      cardExpiry: "#card-expiry",
      cardCvc: "#card-cvc",
    };

    beforeEach(async () => {
      // Load first instance
      service.loadStripe("instance-1", elementIds, false);
      triggerScriptLoad();
      await advanceTimersAndFlush(100);

      // Load second instance (script already loaded)
      service.loadStripe("instance-2", elementIds, false);
      await advanceTimersAndFlush(100);
    });

    it("should not remove script when other instances exist", () => {
      expect(service["instanceCount"]).toBe(2);

      service.unloadStripe("instance-1");

      expect(service["instanceCount"]).toBe(1);
      expect(window.document.head.removeChild).not.toHaveBeenCalled();
    });

    it("should only cleanup specific instance", () => {
      service.unloadStripe("instance-1");

      expect(service["instances"].has("instance-1")).toBe(false);
      expect(service["instances"].has("instance-2")).toBe(true);
    });

    it("should handle reference counting correctly", () => {
      expect(service["instanceCount"]).toBe(2);

      service.unloadStripe("instance-1");
      expect(service["instanceCount"]).toBe(1);

      service.unloadStripe("instance-2");
      expect(service["instanceCount"]).toBe(0);
    });
  });

  describe("unloadStripe - edge cases", () => {
    it("should handle unload of non-existent instance gracefully", () => {
      expect(() => service.unloadStripe("non-existent")).not.toThrow();
      expect(service["instanceCount"]).toBe(0);
    });

    it("should handle duplicate unload calls", async () => {
      const instanceId = "duplicate-unload";
      const elementIds = {
        cardNumber: "#card-number",
        cardExpiry: "#card-expiry",
        cardCvc: "#card-cvc",
      };

      service.loadStripe(instanceId, elementIds, false);
      triggerScriptLoad();
      await advanceTimersAndFlush(100);

      service.unloadStripe(instanceId);
      expect(service["instanceCount"]).toBe(0);

      service.unloadStripe(instanceId);
      expect(service["instanceCount"]).toBe(0); // Should not go negative
    });

    it("should catch and log element unmount errors", async () => {
      const instanceId = "error-unmount";
      const elementIds = {
        cardNumber: "#card-number",
        cardExpiry: "#card-expiry",
        cardCvc: "#card-cvc",
      };

      service.loadStripe(instanceId, elementIds, false);
      triggerScriptLoad();
      await advanceTimersAndFlush(100);

      const unmountError = new Error("Unmount failed");
      mockCardNumber.unmount.mockImplementation(() => {
        throw unmountError;
      });

      service.unloadStripe(instanceId);

      expect(logService.error).toHaveBeenCalledWith(
        expect.stringContaining("Error unmounting Stripe elements"),
        unmountError,
      );
    });
  });

  describe("element styling", () => {
    it("should apply correct CSS custom properties", () => {
      const options = service["getElementOptions"]("cardNumber");

      expect(options.style.base.color).toBe("rgb(0, 0, 0)");
      expect(options.style.base["::placeholder"].color).toBe("rgb(128, 128, 128)");
      expect(options.style.invalid.color).toBe("rgb(0, 0, 0)");
      expect(options.style.invalid.borderColor).toBe("rgb(220, 38, 38)");
    });

    it("should remove placeholder for cardNumber and cardCvc", () => {
      const cardNumberOptions = service["getElementOptions"]("cardNumber");
      const cardCvcOptions = service["getElementOptions"]("cardCvc");
      const cardExpiryOptions = service["getElementOptions"]("cardExpiry");

      expect(cardNumberOptions.placeholder).toBe("");
      expect(cardCvcOptions.placeholder).toBe("");
      expect(cardExpiryOptions.placeholder).toBeUndefined();
    });
  });
});
