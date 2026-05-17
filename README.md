# DevToolkit Pro

DevToolkit Pro is a local-first Chromium extension that puts common developer, QA, and support utilities in one popup. It captures useful clipboard snippets, generates realistic test data, formats JSON, tests API calls from pasted cURL commands, manages disposable TOTP secrets, autofills generated values from the context menu, and keeps per-website notes and todos.

The extension is designed for local unpacked use. Data is stored in your browser profile through IndexedDB, `chrome.storage.local`, and `localStorage`; it is not sent to a remote service by this project.

## Features

| Feature | What you can do | Storage notes |
| --- | --- | --- |
| Clipboard history | Capture copied text from visited pages, search entries, recopy saved snippets, pause capture, set retention limits, and block domains. | Clipboard entries are stored locally in IndexedDB. |
| Website notes and todos | Open the popup on any website and save a note plus a checklist tied to that site's origin. | Notes and todos are stored locally in `chrome.storage.local` by website. |
| Test data generator | Generate Persian names, phone numbers, national codes, bank card numbers, Sheba / IBAN values, emails, UUIDs, and passwords. | Generated values are only copied when you request it or enable auto-copy. |
| Context-menu autofill | Right-click editable fields and insert generated data directly into the page. | Uses the content script to update the selected editable element. |
| API tester | Open a dedicated tab, paste a cURL command, run the request, inspect status, timing, headers, and formatted JSON/text responses, and save requests. | API history and collections are stored locally. Avoid saving production secrets. |
| JSON formatter | Validate, pretty-print, syntax-highlight, and copy JSON from the popup. | Formatting happens locally in the popup. |
| Authenticator | Import a QR image when supported, paste an `otpauth://` URI, or paste a Base32 secret to generate TOTP codes. | OTP secrets stay in the current popup session; treat secrets as sensitive. |

## Installation

1. Clone or download this repository.
2. Open a Chromium browser such as Chrome, Edge, Brave, or another Manifest V3-compatible browser.
3. Go to `chrome://extensions`.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the repository directory that contains `manifest.json`.
7. Pin **DevToolkit Pro** to your toolbar if you want quick access.

## Usage

### Clipboard history

1. Copy text on a webpage.
2. Open DevToolkit Pro and choose **Clipboard**.
3. Click a saved entry to copy it again.
4. Use **Clipboard Settings** to pause capture, change the maximum history size, configure retention, block domains, or clear history.

### Website notes and todos

1. Visit the website you want to document.
2. Open the extension popup and choose **Notes**.
3. Write notes in the notes field.
4. Add todo items with the checklist input.
5. Reopen the same website later to see the saved note and checklist for that site.

Notes are grouped by website origin, so `https://example.com/page-a` and `https://example.com/page-b` share the same notes, while a different origin gets its own entry.

### Data generator

1. Open the popup and choose **Generator**.
2. Select the value type you need.
3. Copy the generated result manually, or enable **Auto Copy** to copy each generated result automatically.
4. For passwords, expand the options panel to adjust character classes and length.

### Context-menu autofill

1. Right-click an editable input, textarea, or contenteditable area.
2. Choose **DevToolkit: Generate Data**.
3. Pick the generator you want.
4. The generated value is inserted into the field that opened the context menu.

### API tester

1. Open the popup and choose **API**.
2. Click **Open in New Tab**.
3. Paste a cURL command.
4. Run the request and inspect the response.
5. Save frequently used requests to collections when useful.

### JSON formatter

1. Open the popup and choose **JSON**.
2. Paste JSON into the input.
3. Click **Format**.
4. Copy the formatted output if needed.

### Authenticator

1. Open the popup and choose **Auth**.
2. Import a QR image if your browser supports QR detection, or paste an `otpauth://` URI / Base32 secret.
3. Click **Load Secret**.
4. Copy the generated TOTP code when needed.

Use disposable development secrets only unless you have reviewed the implementation and browser profile security.

## Privacy and security

DevToolkit Pro is local-first, but it can still store sensitive information if you copy or enter sensitive data. Review these guidelines before using it in production workflows:

- Clipboard capture can save passwords, tokens, customer data, and private messages if you copy them from a page.
- Use blocked domains for production systems, banking sites, password managers, admin consoles, or other sensitive domains.
- Do not save production API keys, bearer tokens, session cookies, or MFA secrets in local API collections, notes, or clipboard history.
- Clear local history before sharing a browser profile, recording demos, or taking screenshots.
- Load the extension only from a repository copy that you trust.

## Project structure

| Path | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3 extension metadata, permissions, content scripts, and icons. |
| `popup.html` | Popup interface for clipboard history, generator, API launcher, JSON formatter, authenticator, and website notes. |
| `popup.css` | Shared popup and API tester styling. |
| `popup.js` | Popup controller, storage logic, generator UI, notes/todos, JSON formatter, authenticator, and API tester behavior. |
| `background.js` | Service worker for clipboard storage and context-menu generator actions. |
| `content.js` | Content script for copy capture and context-menu autofill insertion. |
| `generators.js` | Test data generation helpers. |
| `curlParser.js` | cURL parsing utility for the API tester. |
| `api-tester.html` | Dedicated API tester page. |
| `icons/` | Extension icons. |

## Development

There is no build step in this repository. Edit the source files directly and reload the unpacked extension from `chrome://extensions` after changes.

Recommended manual checks:

1. Reload the extension.
2. Open the popup and verify each tab renders.
3. Generate and copy sample data.
4. Copy safe text from a webpage and verify it appears in Clipboard history.
5. Add a note and todo on one website, navigate to another website, and confirm notes are stored separately.
6. Run a safe API request in the API tester.
7. Format valid and invalid JSON.

## Screenshots

If you add screenshots, place them under `docs/screenshots/` and use fake or redacted data only. Suggested captures:

- Popup overview
- Clipboard history
- Website notes and todos
- Data generator
- API tester
- JSON formatter
- Authenticator
- Context-menu autofill

## License

See [`LICENSE`](LICENSE).
