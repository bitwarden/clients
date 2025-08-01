describe("web app", () => {
  it("should load the homepage", async () => {
    await browser.url("/");
    const title = await browser.getTitle();
    expect(title).not.toEqual("");
  });
});
