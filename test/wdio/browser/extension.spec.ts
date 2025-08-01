describe("browser extension", () => {
  it("should open extensions page", async () => {
    await browser.url("chrome://extensions");
    expect(await browser.getTitle()).toContain("Extensions");
  });
});
