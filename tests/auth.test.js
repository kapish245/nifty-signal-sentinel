const {
  generateLoginUrl,
  extractRequestToken,
} = require("../src/auth/login");
const { handleZerodhaCallback } = require("../src/app");
const { generateChecksum } = require("../src/utils/checksum");

describe("Zerodha auth helpers", () => {
  describe("generateLoginUrl", () => {
    it("should generate the official Zerodha login URL", () => {
      expect(generateLoginUrl("kite_api_key")).toBe(
        "https://kite.zerodha.com/connect/login?v=3&api_key=kite_api_key",
      );
    });

    it("should throw when api key is missing", () => {
      expect(() => generateLoginUrl("")).toThrow("API key is required");
    });
  });

  describe("extractRequestToken", () => {
    it("should extract request_token from a redirect URL", () => {
      expect(
        extractRequestToken(
          "http://localhost:3000/?request_token=req_123&status=success",
        ),
      ).toBe("req_123");
    });

    it("should extract request_token from a query object", () => {
      expect(extractRequestToken({ request_token: "req_456" })).toBe("req_456");
    });

    it("should fail clearly when request_token is missing", () => {
      expect(() =>
        extractRequestToken("http://localhost:3000/?status=success"),
      ).toThrow("Missing request_token in callback");
    });
  });

  describe("generateChecksum", () => {
    it("should generate a SHA256 checksum from api key, request token and secret", () => {
      expect(
        generateChecksum({
          apiKey: "abc123",
          requestToken: "request456",
          apiSecret: "secret789",
        }),
      ).toBe(
        "a817b9ab8ec941385620293e797c667bf4fc1ba54afe15af42d9c50acae17ab6",
      );
    });
  });

  describe("callback app", () => {
    it("should capture and return the request token from the callback handler", async () => {
      const logger = {
        info: jest.fn(),
        error: jest.fn(),
      };
      const onTokenReceived = jest.fn();

      const response = await handleZerodhaCallback({
        query: { request_token: "req_789", action: "login" },
        logger,
        onTokenReceived,
      });

      expect(response).toEqual({
        message: "Request token captured successfully",
        requestToken: "req_789",
      });
      expect(onTokenReceived).toHaveBeenCalledWith("req_789");
      expect(logger.info).toHaveBeenCalledWith(
        { requestToken: "req_789" },
        "Received Zerodha request token",
      );
    });

    it("should fail clearly when request_token is missing", async () => {
      const logger = {
        info: jest.fn(),
        error: jest.fn(),
      };

      await expect(
        handleZerodhaCallback({
          query: { status: "error" },
          logger,
        }),
      ).rejects.toThrow("Missing request_token in callback");
    });

    it("should allow callback handlers to persist the token automatically", async () => {
      const logger = {
        info: jest.fn(),
        error: jest.fn(),
      };
      const onTokenReceived = jest.fn().mockResolvedValue(undefined);

      await handleZerodhaCallback({
        query: { request_token: "req_auto" },
        logger,
        onTokenReceived,
      });

      expect(onTokenReceived).toHaveBeenCalledWith("req_auto");
    });
  });
});
