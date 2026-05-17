# DevToolkit Pro

> A local-first Chromium extension that bundles everyday developer utilities into one fast popup and tab-based toolkit.

DevToolkit Pro is a Manifest V3 browser extension for developers, QA engineers, support teams, and power users who repeatedly copy data from pages, fill test forms, format JSON, inspect API responses, and manage one-time-password secrets during local development. Instead of juggling separate clipboard managers, fake-data generators, JSON formatters, API clients, and authenticator helpers, DevToolkit Pro keeps those workflows close to the browser with a compact popup, a dedicated API tester page, and right-click autofill actions.

The project is designed as a local unpacked extension: data stays on your machine unless you copy, export, sync, or otherwise share it yourself. Because the extension can run on all URLs and can store copied text locally, review the permissions and privacy notes before installing it in a browser profile that handles sensitive production data.

---

## Feature Matrix

| Area | What it does | Primary entry points | Storage / privacy notes |
| --- | --- | --- | --- |
| Clipboard | Captures copied text from web pages when capture is enabled, shows persistent history, supports one-click recopy, max-entry limits, retention settings, blocked domains, and clear-history controls. | `content.js`, `background.js`, `popup.js` | Clipboard history is stored locally in IndexedDB. Copied page text can include passwords, tokens, customer data, or other sensitive values. |
| Data Generator | Generates common test values such as Persian names, phone numbers, national codes, bank cards, Sheba / IBAN values, and email addresses. | `generators.js`, `popup.js` | Generated output is copied only when you press copy or use autofill actions. |
| API Tester | Opens a dedicated API tester tab, parses pasted cURL commands, lets you configure requests, sends requests, and displays response status, timing, headers, and formatted JSON responses. | `api-tester.html`, `popup.js`, `curlParser.js` | Request history / saved collections are stored locally by the extension UI. Avoid storing production secrets. |
| JSON Formatter | Parses, validates, pretty-prints, and syntax-highlights JSON pasted into the popup. | `popup.html`, `popup.js` | Formatting happens locally in the extension UI. |
| Authenticator | Imports manual Base32 secrets or `otpauth://` URIs, optionally reads QR images when supported by the browser, and displays TOTP codes for local workflows. | `popup.html`, `popup.js` | Treat OTP secrets as sensitive. Do not store production MFA secrets in this local tool unless you have reviewed the implementation and retention behavior. |
| Context-menu autofill | Adds right-click generator actions for editable fields and injects generated values into the field that opened the context menu. | `background.js`, `content.js`, `generators.js` | Requires page access so the content script can identify and update editable fields. |

---

## Screenshots

Add screenshots under `docs/screenshots/` so visitors can understand the extension before loading it:

| Screen | Suggested file | What to capture |
| --- | --- | --- |
| Popup overview | `docs/screenshots/popup.png` | Main popup with the Clipboard, Generator, JSON, and Authenticator tabs visible in the navigation. |
| Clipboard history | `docs/screenshots/clipboard.png` | Clipboard tab with several non-sensitive sample entries and settings expanded. |
| Data generator | `docs/screenshots/generator.png` | Generator tab showing generated sample output and copy controls. |
| API tester | `docs/screenshots/api-tester.png` | Dedicated API tester tab after executing a safe sample request. |
| JSON formatter | `docs/screenshots/json-formatter.png` | JSON Formatter tab showing formatted sample JSON. |
| Authenticator | `docs/screenshots/authenticator.png` | Authenticator tab using a disposable demo secret only. |
| Context-menu autofill | `docs/screenshots/context-menu-autofill.png` | Browser context menu opened on a local test form field. |

Screenshot guidelines:

1. Use fake, disposable, or redacted data only.
2. Do not capture production tokens, real clipboard history, real customer data, or personal MFA secrets.
3. Keep image dimensions consistent where possible, for example 1280×800 for tab pages and the natural popup size for popup screenshots.

---

## Installation: Load the Unpacked Chrome Extension

DevToolkit Pro is not packaged for the Chrome Web Store in this repository. Load it as an unpacked extension during development or local use:

1. Clone or download this repository.
2. Open a Chromium browser such as Chrome, Edge, Brave, or another Manifest V3-compatible browser.
3. Navigate to `chrome://extensions`.
4. Enable **Developer mode**.
5. Select **Load unpacked**.
6. Choose the repository directory that contains `manifest.json`.
7. Confirm that **DevToolkit Pro** appears in the extensions list and pin it to the toolbar if desired.
8. Review the extension details page so you understand the requested permissions before using it on sensitive sites.

---

## How to Use

### Clipboard History

1. Copy text from a webpage.
2. When capture is enabled and the domain is not blocked, `content.js` sends the copied text to the service worker.
3. Open the extension popup and select the **Clipboard** tab.
4. Click an entry to copy it back to the clipboard.
5. Use Clipboard Settings to pause capture, limit saved entries, configure retention, block domains, or clear history.

### Data Generator

1. Open the extension popup and select the **Generator** tab.
2. Choose a generator such as Persian Name, Phone Number, National Code, Bank Card, Sheba, or Email.
3. Copy the generated value or use the context-menu autofill feature on editable fields.

### API Tester

1. Open the extension popup and select the **API Tester** tab.
2. Click **Open API Tester** to launch the dedicated tab.
3. Paste a full `curl` command or manually configure the request.
4. Execute the request.
5. Review status, timing, headers, and response output.

### JSON Formatter

1. Open the **JSON** tab.
2. Paste JSON into the input area.
3. Format it to validate and pretty-print the payload.
4. Copy the formatted output if needed.

### Authenticator

1. Open the **Authenticator** tab.
2. Paste a disposable Base32 secret or `otpauth://` URI.
3. If your browser supports QR detection, import a QR image for local test credentials.
4. Use generated TOTP codes only for development or disposable accounts unless you have reviewed the security implications.

---

## Developer Workflow

### Repository Structure

```text
.
├── api-tester.html       # Dedicated API tester page
├── background.js         # Manifest V3 service worker and context-menu handlers
├── content.js            # Page content script for copy capture and autofill injection
├── curlParser.js         # cURL-to-request parser utility
├── generators.js         # Test data generator utility methods
├── icons/                # Extension icons
├── manifest.json         # Extension manifest, permissions, scripts, and action config
├── popup.css             # Popup and API tester styles
├── popup.html            # Main extension popup UI
├── popup.js              # Popup, API tester, JSON formatter, and authenticator controller
└── README.md             # Project documentation
```

### Main Entry Points

- `manifest.json` defines the Manifest V3 extension metadata, permissions, `host_permissions`, service worker, content scripts, popup, and icons.
- `background.js` runs as the extension service worker. It manages clipboard persistence, receives messages from content scripts, creates context menus, and coordinates autofill values.
- `content.js` runs on matched pages. It listens for copy events, tracks editable context-menu targets, and applies generated autofill values.
- `popup.js` controls the popup UI, API tester page, JSON formatter, authenticator import flow, clipboard UI, and local UI state.
- `generators.js` contains reusable fake-data generation helpers.
- `curlParser.js` parses pasted cURL commands into request details the API tester can execute.

### Reload After Changes

1. Save your code changes.
2. Open `chrome://extensions`.
3. Find **DevToolkit Pro**.
4. Click the reload icon on the extension card.
5. Refresh any web pages where you are testing `content.js`, because content scripts already injected into a page may not update until the page reloads.
6. Reopen the popup or API tester tab so the latest `popup.html`, `popup.css`, and `popup.js` are loaded.

### Inspect Logs

- **Popup logs:** Right-click the extension popup and select **Inspect**, or open the popup and use the extension inspection link from `chrome://extensions`. Console output from popup UI code appears in that DevTools window.
- **Service worker logs:** Go to `chrome://extensions`, enable Developer mode, find DevToolkit Pro, and click the **service worker** inspection link. Console output from `background.js` appears there.
- **Content script logs:** Open DevTools on the target webpage. Console output from `content.js` appears in the page's DevTools context.
- **API tester logs:** Open DevTools for the dedicated API tester tab like a normal web page.

---

## Permissions and Privacy Notes

### Permissions

- `storage` allows extension settings and local UI data to be saved.
- `contextMenus` enables right-click generator / autofill actions on editable fields.
- `scripting` and `tabs` support extension interactions with browser tabs and content scripts.
- `host_permissions: ["<all_urls>"]` allows the extension's content script and extension logic to run across websites matched by the manifest. This broad access is needed for clipboard capture from pages and context-menu autofill on arbitrary sites, but it also means you should review the source and only install it in browser profiles where that level of access is acceptable.

### Clipboard Data

Clipboard history is stored locally in the extension's IndexedDB database. The project does not intentionally send clipboard history to a remote service, but locally stored clipboard values can still be sensitive.

Copied text from pages can include:

- Passwords or one-time codes.
- API keys, bearer tokens, cookies, or session identifiers.
- Customer records, internal notes, or personal data.
- Private URLs or query strings containing secrets.

Pause capture, block sensitive domains, clear history regularly, and avoid using this extension on production systems until retention controls and security review meet your requirements.

### Offline / Remote Asset Behavior

The UI is built with local HTML, CSS, and JavaScript. It does not require third-party UI assets or remote fonts to open the popup or API tester.

---

## Browser Support Notes

- DevToolkit Pro targets **Manifest V3 Chromium browsers**, including current versions of Google Chrome and other Chromium-based browsers that support MV3 extension APIs.
- Firefox and Safari are not currently documented as supported targets for this codebase.
- QR import in the Authenticator tool depends on the browser-native `BarcodeDetector` API with QR-code support. Some Chromium builds or operating systems may not provide `BarcodeDetector`, may not support the `qr_code` format, or may gate the feature behind browser implementation details.
- If QR import is unavailable, paste the manual `otpauth://` URI or Base32 secret instead.

---

## TODO / Roadmap

- Add automated tests for `CurlParser`, including headers, methods, request bodies, quoted values, and malformed input.
- Add secure random generation for passwords and UUIDs using browser cryptography APIs where appropriate.
- Improve cURL parsing for additional flags, multipart forms, compressed requests, repeated headers, shell quoting, and edge cases copied from browser DevTools.
- Add clipboard retention controls that are easier to audit, including expiration visibility, per-entry deletion, and safer defaults for sensitive data.
- Add import/export for saved API collections so local request sets can be backed up or moved between development profiles.

---

## Notes for Visitors

- This repository contains a **local unpacked extension**, not a Chrome Web Store listing.
- Review `manifest.json`, requested permissions, and privacy behavior before installing.
- Do not store production secrets, real MFA seeds, customer data, or sensitive clipboard values unless and until retention controls and your operational security requirements are in place.
- Prefer a dedicated development browser profile for testing this extension.

---

## Author

Danial Noroozian
