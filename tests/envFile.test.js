const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const { updateEnvFile, upsertEnvContents } = require("../src/utils/envFile");

describe("envFile helpers", () => {
  it("upserts an existing env key", () => {
    const result = upsertEnvContents(
      "ZERODHA_API_KEY=abc\nZERODHA_REQUEST_TOKEN=old\n",
      "ZERODHA_REQUEST_TOKEN",
      "new_token",
    );

    expect(result).toBe(
      "ZERODHA_API_KEY=abc\nZERODHA_REQUEST_TOKEN=new_token\n",
    );
  });

  it("appends a missing env key", () => {
    const result = upsertEnvContents(
      "ZERODHA_API_KEY=abc\n",
      "ZERODHA_ACCESS_TOKEN",
      "access_123",
    );

    expect(result).toBe(
      "ZERODHA_API_KEY=abc\nZERODHA_ACCESS_TOKEN=access_123\n",
    );
  });

  it("writes env updates to disk", async () => {
    const envPath = path.join(
      os.tmpdir(),
      `nifty-signal-sentinel-env-${Date.now()}-${Math.random().toString(16).slice(2)}.env`,
    );

    await updateEnvFile({
      envPath,
      updates: {
        ZERODHA_REQUEST_TOKEN: "req_123",
        ZERODHA_ACCESS_TOKEN: "access_123",
      },
    });

    const contents = await fs.readFile(envPath, "utf8");

    expect(contents).toContain("ZERODHA_REQUEST_TOKEN=req_123");
    expect(contents).toContain("ZERODHA_ACCESS_TOKEN=access_123");

    await fs.rm(envPath, { force: true });
  });
});
