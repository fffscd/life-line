const fs = require("node:fs/promises");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const siteDir = path.join(rootDir, "site");
const recordsDir = path.join(siteDir, "records");
const generatedMarkerName = ".generated-record";

const htmlEscapeMap = new Map([
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
]);

const escapeHtml = (value) =>
  String(value).replace(/[&<>"]/g, (char) => htmlEscapeMap.get(char));

const parseFrontMatter = (markdown) => {
  if (!markdown.startsWith("---")) {
    return { data: {}, body: markdown };
  }

  const closingMatch = /\r?\n---\r?\n/.exec(markdown.slice(3));
  if (!closingMatch) {
    return { data: {}, body: markdown };
  }

  const headerStart = 3;
  const headerEnd = headerStart + closingMatch.index;
  const bodyStart = headerEnd + closingMatch[0].length;
  const data = {};

  markdown
    .slice(headerStart, headerEnd)
    .split(/\r?\n/)
    .forEach((line) => {
      const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
      if (!match) {
        return;
      }

      const value = match[2].trim().replace(/^["']|["']$/g, "");
      data[match[1]] = value;
    });

  return {
    data,
    body: markdown.slice(bodyStart),
  };
};

const walk = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
};

const fileExists = async (file) => {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
};

const getFirstHeading = (body) => {
  const match = /^#\s+(.+)$/m.exec(body);
  return match ? match[1].trim() : "";
};

const getSummary = (body) => {
  const line = body
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => value && !value.startsWith("#") && !value.startsWith(">"));

  if (!line) {
    return "查看完整记录。";
  }

  return line.length > 72 ? `${line.slice(0, 72)}...` : line;
};

const getRecordDateParts = (relativePath) => {
  const parts = relativePath.split(path.sep);

  if (
    parts.length === 4 &&
    /^\d{4}$/.test(parts[0]) &&
    /^\d{2}$/.test(parts[1]) &&
    /^\d{2}$/.test(parts[2]) &&
    parts[3] === "index.md"
  ) {
    return {
      year: parts[0],
      month: parts[1],
      day: parts[2],
    };
  }

  return null;
};

const getRecordKey = ({ year, month, day }) => `${year}-${month}-${day}`;

const getOutputMarkdownPath = ({ year, month, day }) =>
  path.join(recordsDir, year, month, day, "index.md");

const getRootRecordDateParts = (year, fileName) => {
  const match = /^(\d{2})(\d{2})(?:\.md)?$/.exec(fileName);
  if (!match) {
    return null;
  }

  return {
    year,
    month: match[1],
    day: match[2],
  };
};

const getMarkdownSources = async () => {
  const sources = new Map();
  await cleanupGeneratedRootRecords();
  const allFiles = await walk(recordsDir);
  const siteMarkdownFiles = allFiles.filter(
    (file) => path.basename(file) === "index.md",
  );

  for (const file of siteMarkdownFiles) {
    if (await fileExists(path.join(path.dirname(file), generatedMarkerName))) {
      continue;
    }

    const dateParts = getRecordDateParts(path.relative(recordsDir, file));
    if (!dateParts) {
      continue;
    }

    sources.set(getRecordKey(dateParts), {
      dateParts,
      file,
      shouldCopyToSite: false,
    });
  }

  const rootEntries = await fs.readdir(rootDir, { withFileTypes: true });
  const yearDirs = rootEntries.filter(
    (entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name),
  );

  for (const yearDir of yearDirs) {
    const fullYearDir = path.join(rootDir, yearDir.name);
    const entries = await fs.readdir(fullYearDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const dateParts = getRootRecordDateParts(yearDir.name, entry.name);
      if (!dateParts) {
        continue;
      }

      const key = getRecordKey(dateParts);
      if (sources.has(key)) {
        continue;
      }

      sources.set(key, {
        dateParts,
        file: path.join(fullYearDir, entry.name),
        shouldCopyToSite: true,
      });
    }
  }

  return Array.from(sources.values());
};

const cleanupGeneratedRootRecords = async () => {
  const allFiles = await walk(recordsDir);
  const markerFiles = allFiles.filter(
    (file) => path.basename(file) === generatedMarkerName,
  );

  for (const markerFile of markerFiles) {
    const sourceRelativePath = (await fs.readFile(markerFile, "utf8")).trim();
    if (!sourceRelativePath) {
      continue;
    }

    const sourcePath = path.join(rootDir, sourceRelativePath);
    if (!(await fileExists(sourcePath))) {
      await fs.rm(path.dirname(markerFile), { recursive: true, force: true });
    }
  }
};

const createArticleHtml = ({ title, description, category, displayDate }) => `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="theme-color" content="#f7f4ed" />
    <title>${escapeHtml(title)} | Life Line</title>
    <link rel="icon" href="../../../../favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="../../../../styles.css" />
  </head>
  <body class="article-page">
    <a class="skip-link" href="#main">跳到正文</a>

    <header class="site-header" aria-label="站点导航">
      <a class="brand" href="../../../../" aria-label="Life Line 首页">
        <span class="brand-mark" aria-hidden="true"></span>
        <span>Life Line</span>
      </a>
      <nav class="nav-links" aria-label="主要导航">
        <a href="../../../../#timeline">轨迹</a>
        <a href="../../../../#projects">项目</a>
        <a href="../../../../#notes">记录</a>
        <a href="../../../../#contact">联系</a>
      </nav>
    </header>

    <main id="main" class="article-shell">
      <article class="article-content" data-markdown-src="./index.md">
        <a class="back-link" href="../../../../#notes">返回记录</a>
        <p class="eyebrow">${escapeHtml(category)} / ${escapeHtml(displayDate)}</p>
        <h1>${escapeHtml(title)}</h1>
        <div class="markdown-body" id="recordBody">
          <p>正在加载记录。</p>
        </div>
      </article>
    </main>

    <footer class="site-footer">
      <span>© <span id="year"></span> Life Line</span>
      <span>Powered by GitHub Pages</span>
    </footer>

    <script src="../../../../script.js" defer></script>
  </body>
</html>
`;

const build = async () => {
  const markdownSources = await getMarkdownSources();
  const records = [];

  for (const { dateParts, file, shouldCopyToSite } of markdownSources) {
    const markdown = await fs.readFile(file, "utf8");
    const outputMarkdownPath = getOutputMarkdownPath(dateParts);

    if (shouldCopyToSite) {
      await fs.mkdir(path.dirname(outputMarkdownPath), { recursive: true });
      await fs.writeFile(outputMarkdownPath, markdown);
      await fs.writeFile(
        path.join(path.dirname(outputMarkdownPath), generatedMarkerName),
        `${path.relative(rootDir, file)}\n`,
      );
    }

    const { data, body } = parseFrontMatter(markdown);
    const date = data.date || `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
    const displayDate = date.replaceAll("-", "/");
    const title = data.title || getFirstHeading(body) || displayDate;
    const summary = data.summary || getSummary(body);
    const category = data.category || "记录";
    const href = `./records/${dateParts.year}/${dateParts.month}/${dateParts.day}/`;

    records.push({
      title,
      date,
      category,
      summary,
      href,
    });

    const html = createArticleHtml({
      title,
      description: summary,
      category,
      displayDate,
    });

    await fs.mkdir(path.dirname(outputMarkdownPath), { recursive: true });
    await fs.writeFile(path.join(path.dirname(outputMarkdownPath), "index.html"), html);
  }

  records.sort((left, right) => right.date.localeCompare(left.date));

  await fs.writeFile(
    path.join(recordsDir, "index.js"),
    `// Generated by scripts/build-records.js. Do not edit by hand.\nwindow.LIFE_LINE_RECORDS = ${JSON.stringify(records, null, 2)};\n`,
  );

  console.log(`Built ${records.length} record(s).`);
};

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
