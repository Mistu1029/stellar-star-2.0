import fs from "fs";
import path from "path";

const ROOT_DIR = path.resolve(__dirname, "../..");
const APP_DIR = path.join(ROOT_DIR, "app");
const PAGE_LINE_BUDGET = 300;

describe("page component line budget", () => {
  it(`keeps app page components under ${PAGE_LINE_BUDGET} lines`, () => {
    const pages = findPageComponents(APP_DIR);

    expect(pages.length).toBeGreaterThan(0);

    const oversizedPages = pages
      .map((pagePath) => ({
        pagePath: path.relative(ROOT_DIR, pagePath),
        lines: countLines(pagePath),
      }))
      .filter(({ lines }) => lines > PAGE_LINE_BUDGET);

    expect(oversizedPages).toEqual([]);
  });
});

function findPageComponents(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return findPageComponents(entryPath);
    }

    return entry.isFile() && entry.name === "page.tsx" ? [entryPath] : [];
  });
}

function countLines(filePath: string): number {
  const contents = fs.readFileSync(filePath, "utf8");
  return contents.split(/\r\n|\r|\n/).length;
}
