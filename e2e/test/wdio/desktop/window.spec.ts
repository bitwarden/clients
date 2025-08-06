describe("desktop app", () => {
  it("should open a window", async () => {
    const handles = await browser.getWindowHandles();
    expect(handles.length).toBeGreaterThan(0);
  });
});
