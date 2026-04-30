const fs = require("fs/promises");
const path = require("path");

class JsonFileRepository {
  #root_dir;

  constructor({ root_dir = path.resolve(process.cwd(), "data") } = {}) {
    this.#root_dir = root_dir;
  }

  getRootDir() {
    return this.#root_dir;
  }

  async readJson(relative_path, fallback_value = null) {
    const file_path = this.#resolvePath(relative_path);

    try {
      const contents = await fs.readFile(file_path, "utf8");
      return JSON.parse(contents);
    } catch (error) {
      if (error.code === "ENOENT") {
        return fallback_value;
      }
      throw error;
    }
  }

  async writeJson(relative_path, payload) {
    const file_path = this.#resolvePath(relative_path);
    await fs.mkdir(path.dirname(file_path), { recursive: true });
    await fs.writeFile(file_path, JSON.stringify(payload, null, 2), "utf8");

    return {
      file_path,
      payload,
    };
  }

  #resolvePath(relative_path) {
    if (path.isAbsolute(relative_path)) {
      throw new Error("Repository paths must be relative");
    }

    return path.join(this.#root_dir, relative_path);
  }
}

module.exports = JsonFileRepository;
