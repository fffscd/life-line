const yearElement = document.querySelector("#year");
if (yearElement) {
  yearElement.textContent = new Date().getFullYear().toString();
}

const formatRecordDate = (value) => {
  const [year, month, day] = value.split("-");
  return [year, month, day].filter(Boolean).join("/");
};

const recordList = document.querySelector("#recordList");
const records = Array.isArray(window.LIFE_LINE_RECORDS)
  ? window.LIFE_LINE_RECORDS
  : [];

if (recordList instanceof HTMLElement && records.length > 0) {
  const fragment = document.createDocumentFragment();
  const sortedRecords = records
    .filter((record) => record.title && record.date && record.href)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 6);

  sortedRecords.forEach((record) => {
    const item = document.createElement("article");
    item.className = "note-item";

    const meta = document.createElement("span");
    meta.textContent = `${record.category || "记录"} / ${formatRecordDate(record.date)}`;

    const title = document.createElement("h3");
    const link = document.createElement("a");
    link.className = "record-link";
    link.href = record.href;
    link.textContent = record.title;
    title.append(link);

    const summary = document.createElement("p");
    summary.textContent = record.summary || "查看完整记录。";

    item.append(meta, title, summary);
    fragment.append(item);
  });

  if (fragment.childNodes.length > 0) {
    recordList.replaceChildren(fragment);
  }
}

const appendInlineMarkdown = (element, text) => {
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*)/g;
  let cursor = 0;
  let match = pattern.exec(text);

  while (match) {
    if (match.index > cursor) {
      element.append(document.createTextNode(text.slice(cursor, match.index)));
    }

    if (match[2] && match[3]) {
      const link = document.createElement("a");
      link.href = getSafeMarkdownHref(match[3]);
      link.textContent = match[2];
      if (/^https?:\/\//i.test(match[3])) {
        link.rel = "noreferrer";
      }
      element.append(link);
    } else if (match[4]) {
      const code = document.createElement("code");
      code.textContent = match[4];
      element.append(code);
    } else if (match[5]) {
      const strong = document.createElement("strong");
      strong.textContent = match[5];
      element.append(strong);
    }

    cursor = pattern.lastIndex;
    match = pattern.exec(text);
  }

  if (cursor < text.length) {
    element.append(document.createTextNode(text.slice(cursor)));
  }
};

const getSafeMarkdownHref = (href) => {
  const value = href.trim();
  const lowerValue = value.toLowerCase();

  if (
    lowerValue.startsWith("javascript:") ||
    lowerValue.startsWith("data:") ||
    lowerValue.startsWith("vbscript:")
  ) {
    return "#";
  }

  return value;
};

const appendMarkdownTextBlock = (fragment, tagName, text) => {
  const element = document.createElement(tagName);
  appendInlineMarkdown(element, text);
  fragment.append(element);
};

const renderMarkdown = (markdown) => {
  const content = markdown
    .replace(/^\uFEFF/, "")
    .replace(/^---\n[\s\S]*?\n---\n?/, "");
  const fragment = document.createDocumentFragment();
  const lines = content.split(/\r?\n/);
  let paragraphLines = [];
  let list = null;
  let codeLines = [];
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }

    appendMarkdownTextBlock(fragment, "p", paragraphLines.join(" "));
    paragraphLines = [];
  };

  const flushList = () => {
    if (list) {
      fragment.append(list);
      list = null;
    }
  };

  const appendCodeBlock = () => {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = codeLines.join("\n");
    pre.append(code);
    fragment.append(pre);
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
      appendMarkdownTextBlock(fragment, `h${level}`, headingMatch[2]);
      return;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushParagraph();
      flushList();
      fragment.append(document.createElement("hr"));
      return;
    }

    const quoteMatch = /^>\s?(.+)$/.exec(line);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      const quote = document.createElement("blockquote");
      const quoteText = document.createElement("p");
      appendInlineMarkdown(quoteText, quoteMatch[1]);
      quote.append(quoteText);
      fragment.append(quote);
      return;
    }

    const unorderedListMatch = /^[-*]\s+(.+)$/.exec(line);
    const orderedListMatch = /^\d+\.\s+(.+)$/.exec(line);
    const listMatch = unorderedListMatch || orderedListMatch;

    if (listMatch) {
      flushParagraph();
      const listTagName = unorderedListMatch ? "ul" : "ol";
      if (!list || list.tagName.toLowerCase() !== listTagName) {
        flushList();
        list = document.createElement(listTagName);
      }

      const item = document.createElement("li");
      appendInlineMarkdown(item, listMatch[1]);
      list.append(item);
      return;
    }

    paragraphLines.push(line.trim());
  });

  flushParagraph();
  flushList();

  if (inCodeBlock) {
    appendCodeBlock();
  }

  return fragment;
};

const markdownArticle = document.querySelector("[data-markdown-src]");

if (markdownArticle instanceof HTMLElement) {
  const markdownSource = markdownArticle.dataset.markdownSrc;
  const markdownBody = markdownArticle.querySelector(".markdown-body");

  if (markdownSource && markdownBody instanceof HTMLElement) {
    fetch(markdownSource)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Markdown load failed");
        }
        return response.text();
      })
      .then((markdown) => {
        markdownBody.replaceChildren(renderMarkdown(markdown));
      })
      .catch(() => {
        markdownBody.textContent = "记录加载失败，请稍后再试。";
      });
  }
}

const canvas = document.querySelector("#lifeCanvas");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (canvas instanceof HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  const pointer = { x: 0, y: 0, active: false };
  const palette = ["#3167a9", "#2f7d5b", "#c85f45", "#b9892f"];
  let width = 0;
  let height = 0;
  let nodes = [];
  let frameId = 0;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.max(24, Math.floor(width / 38));
    nodes = Array.from({ length: count }, (_, index) => {
      const progress = count === 1 ? 0 : index / (count - 1);
      return {
        x: progress * width,
        y:
          height * (0.2 + Math.sin(progress * Math.PI * 2.4) * 0.18) +
          Math.random() * height * 0.32,
        radius: 2 + Math.random() * 3,
        speed: 0.25 + Math.random() * 0.55,
        color: palette[index % palette.length],
        phase: Math.random() * Math.PI * 2,
      };
    });
  };

  const draw = (time = 0) => {
    context.clearRect(0, 0, width, height);
    context.lineCap = "round";
    context.lineJoin = "round";

    const path = new Path2D();
    nodes.forEach((node, index) => {
      const wave = Math.sin(time * 0.0007 * node.speed + node.phase) * 16;
      const pointerPull =
        pointer.active && Math.abs(pointer.x - node.x) < 170
          ? (pointer.y - node.y) * 0.06
          : 0;
      const y = node.y + wave + pointerPull;

      if (index === 0) {
        path.moveTo(node.x, y);
      } else {
        const previous = nodes[index - 1];
        const previousWave =
          Math.sin(time * 0.0007 * previous.speed + previous.phase) * 16;
        const previousPointerPull =
          pointer.active && Math.abs(pointer.x - previous.x) < 170
            ? (pointer.y - previous.y) * 0.06
            : 0;
        const middleX = (previous.x + node.x) / 2;
        path.bezierCurveTo(
          middleX,
          previous.y + previousWave + previousPointerPull,
          middleX,
          y,
          node.x,
          y,
        );
      }
    });

    context.strokeStyle = "rgba(23, 33, 28, 0.24)";
    context.lineWidth = 2;
    context.stroke(path);

    nodes.forEach((node, index) => {
      const y = node.y + Math.sin(time * 0.0007 * node.speed + node.phase) * 16;
      const pulse = 1 + Math.sin(time * 0.001 + node.phase) * 0.16;
      context.beginPath();
      context.fillStyle = node.color;
      context.globalAlpha = index % 3 === 0 ? 0.95 : 0.62;
      context.arc(node.x, y, node.radius * pulse, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    });

    if (!reducedMotion.matches) {
      frameId = window.requestAnimationFrame(draw);
    }
  };

  const start = () => {
    window.cancelAnimationFrame(frameId);
    resize();
    draw();
  };

  window.addEventListener("resize", start);
  window.addEventListener("pointermove", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
  });
  window.addEventListener("pointerleave", () => {
    pointer.active = false;
  });
  reducedMotion.addEventListener("change", start);
  start();
}
