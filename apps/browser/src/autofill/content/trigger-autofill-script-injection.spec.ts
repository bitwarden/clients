describe("TriggerAutofillScriptInjection", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe("init", () => {
    it("sends a message to the extension background", () => {
      require("../content/trigger-autofill-script-injection");

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        command: "triggerAutofillScriptInjection",
      });
    });
  });
});
