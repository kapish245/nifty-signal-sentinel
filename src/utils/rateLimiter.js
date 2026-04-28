function requirePositiveInteger(value, fieldName, { allowZero = false } = {}) {
  if (!Number.isInteger(value)) {
    throw new Error(`${fieldName} must be an integer`);
  }

  if (allowZero ? value < 0 : value <= 0) {
    throw new Error(
      `${fieldName} must be ${allowZero ? "zero or greater" : "greater than zero"}`,
    );
  }

  return value;
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function createRateLimiter({
  maxConcurrent = 1,
  minDelayMs = 0,
  nowProvider = () => Date.now(),
  timerProvider = (callback, timeout) => setTimeout(callback, timeout),
} = {}) {
  const normalizedMaxConcurrent = requirePositiveInteger(
    maxConcurrent,
    "maxConcurrent",
  );
  const normalizedMinDelayMs = requirePositiveInteger(
    minDelayMs,
    "minDelayMs",
    { allowZero: true },
  );
  const queue = [];
  let activeCount = 0;
  let nextAvailableAt = 0;
  let pendingTimer = null;

  function clearPendingTimer() {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  }

  function scheduleDrain(runNext) {
    clearPendingTimer();
    pendingTimer = timerProvider(() => {
      pendingTimer = null;
      runNext();
    }, 0);
  }

  function drainQueue() {
    if (activeCount >= normalizedMaxConcurrent || queue.length === 0) {
      return;
    }

    const now = nowProvider();

    if (now < nextAvailableAt) {
      clearPendingTimer();
      pendingTimer = timerProvider(() => {
        pendingTimer = null;
        drainQueue();
      }, nextAvailableAt - now);
      return;
    }

    const workItem = queue.shift();
    activeCount += 1;
    nextAvailableAt = now + normalizedMinDelayMs;

    Promise.resolve()
      .then(() => workItem.task())
      .then(workItem.resolve, workItem.reject)
      .finally(() => {
        activeCount -= 1;
        scheduleDrain(drainQueue);
      });
  }

  return {
    schedule(task) {
      if (typeof task !== "function") {
        return Promise.reject(new Error("task must be a function"));
      }

      return new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        drainQueue();
      });
    },
    getState() {
      return {
        activeCount,
        pendingCount: queue.length,
        nextAvailableAt,
      };
    },
  };
}

module.exports = {
  createRateLimiter,
  delay,
};
