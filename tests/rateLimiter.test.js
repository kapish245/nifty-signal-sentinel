const { createRateLimiter, delay } = require("../src/utils/rateLimiter");

describe("rateLimiter", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("enforces a minimum delay between task starts", async () => {
    jest.useFakeTimers();
    const limiter = createRateLimiter({
      maxConcurrent: 1,
      minDelayMs: 100,
    });
    const startTimes = [];
    const tasks = [1, 2, 3].map(() =>
      limiter.schedule(async () => {
        startTimes.push(Date.now());
      }),
    );

    await jest.runAllTimersAsync();
    await Promise.all(tasks);

    expect(startTimes).toHaveLength(3);
    expect(startTimes[1] - startTimes[0]).toBeGreaterThanOrEqual(100);
    expect(startTimes[2] - startTimes[1]).toBeGreaterThanOrEqual(100);
  });

  it("does not exceed the configured concurrency", async () => {
    const limiter = createRateLimiter({
      maxConcurrent: 2,
      minDelayMs: 0,
    });
    let activeCount = 0;
    let peakActiveCount = 0;

    const tasks = [1, 2, 3, 4, 5].map(() =>
      limiter.schedule(async () => {
        activeCount += 1;
        peakActiveCount = Math.max(peakActiveCount, activeCount);
        await delay(20);
        activeCount -= 1;
      }),
    );

    await Promise.all(tasks);

    expect(peakActiveCount).toBeLessThanOrEqual(2);
  });
});
