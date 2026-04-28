const fs = require("fs/promises");
const path = require("path");

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
}

function escapeEnvValue(value) {
  return String(value).replace(/\n/g, "\\n");
}

function upsertEnvContents(contents, key, value) {
  const normalizedKey = requireNonEmptyString(key, "Environment key");
  const serializedLine = `${normalizedKey}=${escapeEnvValue(value)}`;
  const pattern = new RegExp(`^${normalizedKey}=.*$`, "m");

  if (pattern.test(contents)) {
    return contents.replace(pattern, serializedLine);
  }

  if (contents.trim() === "") {
    return `${serializedLine}\n`;
  }

  const suffix = contents.endsWith("\n") ? "" : "\n";
  return `${contents}${suffix}${serializedLine}\n`;
}

async function updateEnvFile({
  envPath = path.resolve(process.cwd(), ".env"),
  updates,
} = {}) {
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    throw new Error("updates must be an object");
  }

  let contents = "";

  try {
    contents = await fs.readFile(envPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  let nextContents = contents;

  for (const [key, value] of Object.entries(updates)) {
    if (typeof value !== "string" || value.trim() === "") {
      continue;
    }

    nextContents = upsertEnvContents(nextContents, key, value);
  }

  await fs.mkdir(path.dirname(envPath), { recursive: true });
  await fs.writeFile(envPath, nextContents, "utf8");

  return {
    envPath,
    updatedKeys: Object.keys(updates).filter(
      (key) => typeof updates[key] === "string" && updates[key].trim() !== "",
    ),
  };
}

module.exports = {
  updateEnvFile,
  upsertEnvContents,
};
