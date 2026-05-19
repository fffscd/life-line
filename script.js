const yearElement = document.querySelector("#year");
if (yearElement) {
  yearElement.textContent = new Date().getFullYear().toString();
}

const formatRecordDate = (value) => {
  const [year, month, day] = value.split("-");
  return [year, month, day].filter(Boolean).join("/");
};

const recordList = document.querySelector("#recordList");
const showMoreRecordsButton = document.querySelector("#showMoreRecords");
const records = Array.isArray(window.LIFE_LINE_RECORDS)
  ? window.LIFE_LINE_RECORDS
  : [];
const initialRecordCount = 10;

if (recordList instanceof HTMLElement && records.length > 0) {
  const sortedRecords = records
    .filter((record) => record.title && record.date && record.href)
    .sort((left, right) => right.date.localeCompare(left.date));

  const renderRecords = (visibleRecords) => {
    const fragment = document.createDocumentFragment();

    visibleRecords.forEach((record) => {
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
  };

  renderRecords(sortedRecords.slice(0, initialRecordCount));

  if (
    showMoreRecordsButton instanceof HTMLButtonElement &&
    sortedRecords.length > initialRecordCount
  ) {
    showMoreRecordsButton.hidden = false;
    showMoreRecordsButton.addEventListener("click", () => {
      renderRecords(sortedRecords);
      showMoreRecordsButton.hidden = true;
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
