# DevToolkit Pro

&gt; A professional, all-in-one browser toolkit for developers.

DevToolkit Pro is a lightweight and powerful Chrome extension designed to streamline common development tasks. It combines a persistent clipboard manager, a flexible data generator, and an API tester into a single, convenient package.

This project was built to replace the need for multiple, separate utilities and keep essential tools just a click away.

---

## Features

* **Clipboard Manager**
    * **Persistent History:** Automatically captures and logs text you copy from any website.
    * **IndexedDB Storage:** History is saved locally and persistently using IndexedDB, managed by the service worker.
    * **One-Click Copy:** Click any entry in the history list to instantly copy it back to your clipboard.
    * **Clear History:** A simple button to clear all saved clipboard entries.

* **Data Generator**
    * **One-Click Generation:** Quickly generate common data types needed for testing forms and populating databases.
    * **Available Data:** Includes Persian Name, Phone Number, National Code, Bank Card, Sheba (IBAN), and Email.
    * **Easy Copy:** Generated data appears in an output box with a "Copy" button.

* **API Tester (in a Dedicated Tab)**
    * **cURL Parser:** Automatically parses pasted `curl` commands to set up the request.
    * **Full-Featured:** Supports different methods (GET, POST, etc.), custom headers (`-H`), and raw data bodies (`--data-raw`).
    * **Syntax Highlighting:** Displays formatted JSON responses with clear syntax highlighting for easy reading.
    * **Request Info:** Shows the response status code (`200 OK`, `404 Not Found`, etc.) and the total request time in milliseconds.

* **General UI/UX**
    * **Modern Dark UI:** A sleek, dark-mode interface that's easy on the eyes.
    * **Resizable Popup:** The main popup window can be resized, allowing you to see more clipboard history or generator options.
    * **Notifications:** Provides toast notifications for actions like "Copied to clipboard!".

---

## Screenshots

---

## Installation

Since this extension is not yet on the Chrome Web Store, you can load it locally:

1.  Download or clone this repository to your local machine.
2.  Open the Chrome browser and navigate to `chrome://extensions`.
3.  Enable **"Developer mode"** in the top-right corner.
4.  Click the **"Load unpacked"** button.
5.  Select the directory where you saved the project files.
6.  The DevToolkit Pro icon will appear in your browser's toolbar.

---

## How to Use

* **Clipboard History:**
    1.  Simply copy text from any webpage. The extension's content script will automatically log it.
    2.  Click the extension icon and go to the **Clipboard** tab to see your history. Click any entry to re-copy it.

* **Data Generator:**
    1.  Open the extension and click the **Generator** tab.
    2.  Click any button (e.g., "Persian Name", "Bank Card") to generate new data.
    3.  The generated data will appear in the output box. Click "Copy" to use it.

* **API Tester:**
    1.  Open the extension and click the **API Tester** tab.
    2.  Click the **"Open API Tester"** button. This will open the tool in a new, dedicated browser tab.
    3.  Paste a full `curl` command (e.g., from your browser's Network tab) into the text area.
    4.  Click **"Execute Request"**.
    5.  The response body, status, and time will appear below.

---

## Tech Stack & Project Structure

This extension is built with **Manifest V3** and pure, "vanilla" JavaScript (ES6+) for maximum performance and minimal overhead.

* **`manifest.json`**: Defines the extension, permissions (`storage`, `host_permissions`), and entry points.
* **`background.js`**: A persistent service worker that manages the core `ClipboardManager` class. It listens for messages from content scripts and handles saving data to IndexedDB.
* **`content.js`**: Injected into web pages to listen for `copy` events and send the copied text to the background script.
* **`popup.html` / `api-tester.html`**: The HTML files for the main popup and the dedicated API tester tab.
* **`popup.css`**: Contains all styles for the extension, using CSS variables for easy theming.
* **`popup.js`**: The main controller (`PopupController`) for the UI. It's context-aware and runs different logic depending on whether it's loaded in the popup or the `api-tester.html` tab. It manages tab switching, IndexedDB read/clear operations, and all UI event listeners.
* **`curlParser.js`**: A utility class (`CurlParser`) with static methods to parse raw `curl` command strings into `fetch()` compatible URL and options objects.
* **`generators.js`**: A utility class (`DataGenerators`) with static methods for generating all the required test data, including logic for Luhn checks (bank cards) and IBAN validation.

## Author

Danial Noroozian