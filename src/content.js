(() => {
  if (window.__markupNotesLoaded) {
    return;
  }

  window.__markupNotesLoaded = true;

  const PANEL_ID = "markup-notes-root";
  const CAPTURE_ID = "markup-notes-capture";
  const STORAGE_PREFIX = "markup-notes:";
  const pageKey = `${STORAGE_PREFIX}${location.origin}${location.pathname}${location.search}`;

  let rootHost;
  let shadow;
  let textarea;
  let captureButton;
  let lastSelectionText = "";
  let lastRange = null;
  let saveTimer = 0;

  const starterMarkdown = () => {
    const title = document.title ? `# ${document.title}` : "# Untitled page";
    return `${title}\n\nSource: ${location.href}\n\n## Notes\n\n`;
  };

  const storageGet = (key) =>
    new Promise((resolve) => chrome.storage.local.get(key, (result) => resolve(result[key])));

  const storageSet = (items) =>
    new Promise((resolve) => chrome.storage.local.set(items, resolve));

  const escapeFilename = (name) =>
    (name || "markup-notes")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 90) || "markup-notes";

  const quoteMarkdown = (text) =>
    text
      .trim()
      .split(/\r?\n/)
      .map((line) => `> ${line.trim()}`)
      .join("\n");

  const scheduleSave = () => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      storageSet({ [pageKey]: textarea.value });
    }, 250);
  };

  const appendPassage = (text) => {
    const cleanText = text.trim();
    if (!cleanText) {
      return;
    }

    const insert = `\n\n${quoteMarkdown(cleanText)}\n\n`;
    textarea.value = `${textarea.value.trimEnd()}${insert}`;
    textarea.focus();
    textarea.selectionStart = textarea.value.length;
    textarea.selectionEnd = textarea.value.length;
    scheduleSave();
  };

  const tryHighlightRange = (range) => {
    if (!range || range.collapsed) {
      return;
    }

    try {
      const mark = document.createElement("mark");
      mark.className = "markup-notes-highlight";
      const fragment = range.extractContents();
      mark.appendChild(fragment);
      range.insertNode(mark);
    } catch {
      // Some complex selections span markup that cannot be wrapped cleanly.
    }
  };

  const downloadMarkdown = () => {
    const blob = new Blob([textarea.value], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${escapeFilename(document.title)}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const createButton = (label, title, onClick) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = title;
    button.addEventListener("click", onClick);
    return button;
  };

  const createPanel = async () => {
    rootHost = document.getElementById(PANEL_ID);
    if (rootHost) {
      shadow = rootHost.shadowRoot;
      textarea = shadow.querySelector("textarea");
      return;
    }

    rootHost = document.createElement("div");
    rootHost.id = PANEL_ID;
    rootHost.hidden = true;
    document.documentElement.appendChild(rootHost);
    shadow = rootHost.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host {
        all: initial;
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .panel {
        position: fixed;
        inset: 0 0 0 auto;
        z-index: 2147483647;
        width: min(440px, 38vw);
        min-width: 320px;
        height: 100vh;
        display: grid;
        grid-template-rows: auto 1fr auto;
        background: #fbfaf7;
        border-left: 1px solid #d8d3c8;
        box-shadow: -12px 0 30px rgba(37, 32, 24, 0.16);
        transform: translateX(0);
      }

      .header,
      .footer {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px;
        background: #f1eee6;
        border-bottom: 1px solid #d8d3c8;
      }

      .footer {
        justify-content: space-between;
        border-top: 1px solid #d8d3c8;
        border-bottom: 0;
        color: #696256;
        font-size: 12px;
      }

      .title {
        flex: 1;
        min-width: 0;
        color: #28241e;
        font-size: 13px;
        font-weight: 700;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      button {
        appearance: none;
        border: 1px solid #c8c1b4;
        background: #ffffff;
        color: #2e2922;
        border-radius: 6px;
        height: 32px;
        padding: 0 10px;
        font: 600 12px/1 Inter, ui-sans-serif, system-ui, sans-serif;
        cursor: pointer;
      }

      button:hover {
        background: #f8f4ec;
      }

      textarea {
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        resize: none;
        border: 0;
        outline: 0;
        padding: 14px;
        background: #fbfaf7;
        color: #201d19;
        font: 14px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      }

      @media (max-width: 760px) {
        .panel {
          width: min(100vw, 380px);
          min-width: 0;
        }
      }
    `;

    const panel = document.createElement("aside");
    panel.className = "panel";
    panel.setAttribute("aria-label", "Markup Notes");

    const header = document.createElement("div");
    header.className = "header";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = "Markup Notes";

    const addSelection = createButton("Add selection", "Add the currently selected passage to the note", () => {
      const selected = getPageSelection();
      if (selected.text) {
        appendPassage(selected.text);
        tryHighlightRange(selected.range);
        hideCaptureButton();
      }
    });

    const exportButton = createButton("Export .md", "Download this note as markdown", downloadMarkdown);
    const closeButton = createButton("Close", "Hide the notes panel", togglePanel);

    header.append(title, addSelection, exportButton, closeButton);

    textarea = document.createElement("textarea");
    textarea.spellcheck = true;
    textarea.placeholder = "Write markdown notes here. Select text on the page, then use Add selection.";
    textarea.value = (await storageGet(pageKey)) || starterMarkdown();
    textarea.addEventListener("input", scheduleSave);

    const footer = document.createElement("div");
    footer.className = "footer";
    footer.innerHTML = `<span>Saved locally for this page</span><span>Ctrl/Command + Shift + M</span>`;

    panel.append(header, textarea, footer);
    shadow.append(style, panel);
  };

  const getPageSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return { text: "", range: null };
    }

    const range = selection.getRangeAt(0);
    if (rootHost?.contains(range.commonAncestorContainer)) {
      return { text: "", range: null };
    }

    return {
      text: selection.toString(),
      range: range.cloneRange()
    };
  };

  const togglePanel = async () => {
    await createPanel();
    rootHost.hidden = !rootHost.hidden;
  };

  const showPanel = async () => {
    await createPanel();
    rootHost.hidden = false;
  };

  const hideCaptureButton = () => {
    captureButton?.remove();
    captureButton = null;
  };

  const showCaptureButton = async (range, text) => {
    if (!text.trim()) {
      hideCaptureButton();
      return;
    }

    lastSelectionText = text;
    lastRange = range.cloneRange();

    hideCaptureButton();
    captureButton = document.createElement("button");
    captureButton.id = CAPTURE_ID;
    captureButton.type = "button";
    captureButton.textContent = "Add to notes";
    captureButton.addEventListener("mousedown", (event) => event.preventDefault());
    captureButton.addEventListener("click", async () => {
      await showPanel();
      appendPassage(lastSelectionText);
      tryHighlightRange(lastRange);
      hideCaptureButton();
      window.getSelection()?.removeAllRanges();
    });

    const rect = range.getBoundingClientRect();
    captureButton.style.left = `${Math.min(window.innerWidth - 132, Math.max(12, rect.left + window.scrollX))}px`;
    captureButton.style.top = `${Math.max(12, rect.bottom + window.scrollY + 8)}px`;
    document.documentElement.appendChild(captureButton);
  };

  document.addEventListener("mouseup", () => {
    window.setTimeout(() => {
      const { text, range } = getPageSelection();
      if (text && range) {
        showCaptureButton(range, text);
      } else {
        hideCaptureButton();
      }
    }, 0);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideCaptureButton();
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "MARKUP_TOGGLE") {
      togglePanel();
    }
  });
})();
