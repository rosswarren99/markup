async function sendToggle(tab) {
  if (!tab?.id || !tab.url || tab.url.startsWith("chrome://")) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "MARKUP_TOGGLE" });
  } catch {
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["src/content.css"]
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/content.js"]
    });
    await chrome.tabs.sendMessage(tab.id, { type: "MARKUP_TOGGLE" });
  }
}

chrome.action.onClicked.addListener(sendToggle);

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-notes") {
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await sendToggle(tab);
});
