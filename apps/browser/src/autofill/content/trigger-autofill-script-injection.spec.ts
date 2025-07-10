describe("TriggerAutofillScriptInjection", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe("init", () => {
    it("sends a message to the extension background", () => {
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("../content/trigger-autofill-script-injection");

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        command: "triggerAutofillScriptInjection",
      });
    });
  });
});
