# Markup Notes

Markup Notes is a Chrome extension MVP for reading a webpage with a markdown note column beside it.

## Features

- Toggle a right-side notes panel from the extension icon.
- Select passage text on the page and add it to the note.
- Captured passages are inserted as markdown blockquotes.
- Selected passages are highlighted on the current page.
- Notes autosave locally per page.
- Export the current note as a `.md` file.

## Install Locally

1. Open Chrome and go to `chrome://extensions`.
2. Turn on `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder: `C:\Users\rossw\OneDrive\Documents\markup`.
5. Open a webpage and click the Markup Notes extension icon.

## Notes

This first version saves notes locally in Chrome extension storage using the page origin and path as the key. Highlight restoration after a page reload is intentionally left for a later version because durable web annotation needs more careful anchoring than a simple selected-text match.

Need to improve this to handle PDFs
