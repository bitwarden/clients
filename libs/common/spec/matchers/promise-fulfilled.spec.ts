describe("toBeFulfilled", () => {
  it("passes when promise is resolved", async () => {
    const promise = Promise.resolve("resolved");
    await promise;
    await expect(promise).toBeFulfilled();
  });

  it("passes when promise is rejected", async () => {
    const promise = Promise.reject("rejected");
    await promise.catch(() => {});
    await expect(promise).toBeFulfilled();
  });

  it("fails when promise is pending", async () => {
    const promise = new Promise((resolve) => setTimeout(resolve, 1000));
    await expect(promise).not.toBeFulfilled();
  });

  it("passes when the promise is fulfilled within the given time limit", async () => {
    const promise = new Promise((resolve) => setTimeout(resolve, 1));
    await expect(promise).toBeFulfilled(25);
  });

  it("passes when the promise is not fulfilled within the given time limit", async () => {
    const promise = new Promise(() => {});
    await expect(promise).not.toBeFulfilled(1);
  });
});

describe("toBeResolved", () => {
  it("passes when promise is resolved", async () => {
    const promise = Promise.resolve("resolved");
    await promise;
    await expect(promise).toBeResolved();
  });

  it("fails when promise is rejected", async () => {
    const promise = Promise.reject("rejected");
    await promise.catch(() => {});
    await expect(promise).not.toBeResolved();
  });

  it("fails when promise is pending", async () => {
    const promise = new Promise((resolve) => setTimeout(resolve, 1000));
    await expect(promise).not.toBeResolved();
  });

  it("passes when the promise is resolved within the given time limit", async () => {
    const promise = new Promise((resolve) => setTimeout(resolve, 1));
    await expect(promise).toBeResolved(50);
  });

  it("passes when the promise is not resolved within the given time limit", async () => {
    const promise = new Promise(() => {});
    await expect(promise).not.toBeResolved(1);
  });
});

describe("toBeRejected", () => {
  it("fails when promise is resolved", async () => {
    const promise = Promise.resolve("resolved");
    await promise;
    await expect(promise).not.toBeRejected();
  });

  it("passes when promise is rejected", async () => {
    const promise = Promise.reject("rejected");
    await promise.catch(() => {});
    await expect(promise).toBeRejected();
  });

  it("fails when promise is pending", async () => {
    const promise = new Promise((resolve) => setTimeout(resolve, 1000));
    await expect(promise).not.toBeRejected();
  });

  it("passes when the promise is resolved within the given time limit", async () => {
    const promise = new Promise((_, reject) => setTimeout(reject, 1));
    await expect(promise).toBeFulfilled(50);
  });

  it("passes when the promise is not resolved within the given time limit", async () => {
    const promise = new Promise(() => {});
    await expect(promise).not.toBeFulfilled(1);
  });
});
