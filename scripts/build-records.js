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

const getSafeMarkdownUrl = (url) => {
  const value = url.trim();
  const lowerValue = value.replace(/[\u0000-\u001F\u007F\s]+/g, "").toLowerCase();

  if (
    lowerValue.startsWith("javascript:") ||
    lowerValue.startsWith("data:") ||
    lowerValue.startsWith("vbscript:")
  ) {
    return "#";
  }

  return value;
};

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

const renderInlineMarkdown = (text) => {
  const pattern = /(!?\[([^\]]*)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*)/g;
  let cursor = 0;
  let html = "";
  let match = pattern.exec(text);

  while (match) {
    if (match.index > cursor) {
      html += escapeHtml(text.slice(cursor, match.index));
    }

    if (match[1]) {
      const label = match[2];
      const url = getSafeMarkdownUrl(match[3]);

      if (match[1].startsWith("!")) {
        html += `<img src="${escapeHtml(url)}" alt="${escapeHtml(label)}" loading="lazy" />`;
      } else {
        const rel = /^https?:\/\//i.test(url) ? ' rel="noreferrer"' : "";
        html += `<a href="${escapeHtml(url)}"${rel}>${escapeHtml(label)}</a>`;
      }
    } else if (match[4]) {
      html += `<code>${escapeHtml(match[4])}</code>`;
    } else if (match[5]) {
      html += `<strong>${escapeHtml(match[5])}</strong>`;
    }

    cursor = pattern.lastIndex;
    match = pattern.exec(text);
  }

  if (cursor < text.length) {
    html += escapeHtml(text.slice(cursor));
  }

  return html;
};

const removeLeadingTitleHeading = (body, title) => {
  const lines = body.replace(/^\uFEFF/, "").split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() !== "");

  if (headingIndex < 0) {
    return "";
  }

  const headingMatch = /^#\s+(.+)$/.exec(lines[headingIndex].trim());
  if (!headingMatch || headingMatch[1].trim() !== title) {
    return body;
  }

  lines.splice(headingIndex, 1);
  return lines.join("\n").replace(/^\s+/, "");
};

const renderMarkdownToHtml = (markdown) => {
  const lines = markdown.replace(/^\uFEFF/, "").split(/\r?\n/);
  const html = [];
  let paragraphLines = [];
  let list = null;
  let codeLines = [];
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }

    html.push(`<p>${renderInlineMarkdown(paragraphLines.join(" "))}</p>`);
    paragraphLines = [];
  };

  const flushList = () => {
    if (!list) {
      return;
    }

    html.push(`<${list.tagName}>${list.items.join("")}</${list.tagName}>`);
    list = null;
  };

  const appendCodeBlock = () => {
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    codeLines = [];
  };

  lines.forEach((line) => {
    if (line.trim().startsWith("```")) {
      flushParagraph();
      flushList();

      if (inCodeBlock) {
        appendCodeBlock();
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      return;
    }

    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = Math.min(5, headingMatch[1].length + 1);
      html.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      return;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushParagraph();
      flushList();
      html.push("<hr />");
      return;
    }

    const quoteMatch = /^>\s?(.+)$/.exec(line);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      html.push(`<blockquote><p>${renderInlineMarkdown(quoteMatch[1])}</p></blockquote>`);
      return;
    }

    const unorderedListMatch = /^[-*]\s+(.+)$/.exec(line);
    const orderedListMatch = /^\d+\.\s+(.+)$/.exec(line);
    const listMatch = unorderedListMatch || orderedListMatch;

    if (listMatch) {
      flushParagraph();
      const listTagName = unorderedListMatch ? "ul" : "ol";
      if (!list || list.tagName !== listTagName) {
        flushList();
        list = { tagName: listTagName, items: [] };
      }

      list.items.push(`<li>${renderInlineMarkdown(listMatch[1])}</li>`);
      return;
    }

    paragraphLines.push(line.trim());
  });

  flushParagraph();
  flushList();

  if (inCodeBlock) {
    appendCodeBlock();
  }

  return html.join("\n") || "<p>暂无正文。</p>";
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

const createArticleHtml = ({
  title,
  description,
  category,
  displayDate,
  bodyHtml,
}) => `<!doctype html>
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
        <a href="../../../../records.html" aria-current="page">记录</a>
        <a href="../../../../running.html">跑步</a>
        <a href="../../../../reading.html">阅读</a>
        <a href="../../../../photos.html">日常照片</a>
        <a href="../../../../contact.html">联系</a>
      </nav>
    </header>

    <main id="main" class="article-shell">
      <article class="article-content">
        <a class="back-link" href="../../../../records.html">返回记录</a>
        <p class="eyebrow">${escapeHtml(category)} / ${escapeHtml(displayDate)}</p>
        <h1>${escapeHtml(title)}</h1>
        <div class="markdown-body" id="recordBody">
${bodyHtml}
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
    const articleBody = removeLeadingTitleHeading(body, title);
    const bodyHtml = renderMarkdownToHtml(articleBody);

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
      bodyHtml,
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
