jest.mock("../src/auth/token", () => ({
  loadPersistedToken: jest.fn(),
}));

const { loadPersistedToken } = require("../src/auth/token");
const { resolveAccessToken } = require("../src/runner");

describe("runner token resolution", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.ZERODHA_ACCESS_TOKEN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("prefers persisted token when both persisted and env tokens exist", async () => {
    loadPersistedToken.mockResolvedValue({
      accessToken: "persisted_token_1",
    });
    process.env.ZERODHA_ACCESS_TOKEN = "env_token_1";
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
    };

    const token = await resolveAccessToken({
      tokenPath: "./tmp/kite-session.json",
      logger,
    });

    expect(token).toBe("persisted_token_1");
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("falls back to env token when persisted token is missing", async () => {
    loadPersistedToken.mockResolvedValue(null);
    process.env.ZERODHA_ACCESS_TOKEN = "env_token_2";
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
    };

    const token = await resolveAccessToken({
      tokenPath: "./tmp/kite-session.json",
      logger,
    });

    expect(token).toBe("env_token_2");
    expect(logger.info).toHaveBeenCalled();
  });

  it("throws when both persisted and env tokens are missing", async () => {
    loadPersistedToken.mockResolvedValue(null);

    await expect(
      resolveAccessToken({
        tokenPath: "./tmp/kite-session.json",
        logger: {
          info: jest.fn(),
          warn: jest.fn(),
        },
      }),
    ).rejects.toThrow(
      "Access token not found. Set ZERODHA_ACCESS_TOKEN or persist a session file first.",
    );
  });
});
