# Embedding the Agent Chat Widget

This guide explains how to add the Agentforce-on-EK chat widget to an existing website as an iframe addon, with optional control over citation hover, preview modal, and table-of-contents features.

## Overview

The embed is a **chat widget** that runs inside an iframe. It supports:

- **Citation hover**: Hovering over a citation in the agent’s reply shows a small card with metadata and chunk preview.
- **Citation preview**: Clicking a citation opens a modal with the full article and optional table of contents.
- **TOC**: In the citation modal, users can expand to see a table of contents and open other articles.

You can enable or disable each of these via URL parameters or the loader script. The widget communicates with the host page via **postMessage** so the host can show/hide a floating button and resize the iframe when the chat is open or closed.

## Quick start

1. Host the app (or use an existing deployment) and choose a **customer ID** that exists in your server’s customer config (e.g. `salesforce`).
2. Include the loader script with your app’s base URL and that customer ID:

```html
<script
  src="https://your-app.com/embed/agent-embed.js"
  data-base-url="https://your-app.com"
  data-customer-id="salesforce"
></script>
```

The script creates the iframe and a floating button. When the user closes the chat, the iframe shrinks and the button appears; clicking the button reopens the chat.

For a working example, see the demo pages under `client/public/demo-pages/` (e.g. `getting-started.html`).

## Embed URL format

The embed is loaded from:

```
{baseUrl}/{customerId}?embed=1[&hover=0|1][&preview=0|1][&toc=0|1]
```

- **baseUrl**: Root URL of the app (e.g. `https://your-app.com`). No trailing slash.
- **customerId**: Must match an existing customer `id` in the server’s `customers.json`.
- **embed=1**: Required to enable embed layout (widget only, no main app chrome).

Optional query parameters control content features (all default to `1` when omitted):

| Parameter | Values | Default | Effect when `0` (disabled) |
|-----------|--------|---------|-----------------------------|
| `hover`   | `0`, `1` | `1` | No citation hover card; citations still clickable. |
| `preview` | `0`, `1` | `1` | Citation click opens the article in a new tab instead of the in-page modal. |
| `toc`     | `0`, `1` | `1` | Citation modal does not show the “Show table of contents” button or TOC sidebar. |

**Examples:**

- All features on: `https://your-app.com/salesforce?embed=1`
- Hover and preview only (no TOC): `https://your-app.com/salesforce?embed=1&toc=0`
- Preview only (no hover, no TOC): `https://your-app.com/salesforce?embed=1&hover=0&toc=0`

## Loader script

**Script URL:** `{baseUrl}/embed/agent-embed.js`  
Example: `https://your-app.com/embed/agent-embed.js`

After building the client, the script is available at `client/public/embed/agent-embed.js` and is deployed with the app (e.g. under `/embed/agent-embed.js`).

### Script tag attributes

Configure the embed by setting `data-*` attributes on the script tag:

| Attribute | Required | Type | Default | Description |
|-----------|----------|------|---------|-------------|
| `data-base-url` | Yes | string | — | Root URL of the app (no trailing slash). |
| `data-customer-id` | Yes | string | — | Customer ID from your server config. |
| `data-features` | No | string | `hover,preview,toc` | Comma-separated list of features to enable: `hover`, `preview`, `toc`. Omit a feature to disable it (e.g. `hover,preview` disables TOC). |
| `data-bottom` | No | number | `24` | Distance in pixels from the bottom of the viewport for the widget and button. |
| `data-right` | No | number | `24` | Distance in pixels from the right of the viewport. |
| `data-button-selector` | No | string | — | CSS selector for an existing button to use instead of the script-injected one. The script will still create the iframe and handle resize; your button must trigger opening (see PostMessage API). |

**Example (script tag only):**

```html
<script
  src="https://your-app.com/embed/agent-embed.js"
  data-base-url="https://your-app.com"
  data-customer-id="salesforce"
  data-features="hover,preview,toc"
  data-bottom="24"
  data-right="24"
></script>
```

**Example (disable TOC):**

```html
<script
  src="https://your-app.com/embed/agent-embed.js"
  data-base-url="https://your-app.com"
  data-customer-id="salesforce"
  data-features="hover,preview"
></script>
```

### JavaScript API

You can configure the embed programmatically instead of (or in addition to) data attributes.

**`AgentEmbed.init(config)`**

- **config** (object):
  - `baseUrl` (string, required): Root URL of the app.
  - `customerId` (string, required): Customer ID.
  - `features` (object or string, optional): If object: `{ hover: true, preview: true, toc: true }`. If string: same as `data-features` (e.g. `"hover,preview"`). Defaults: all `true`.
  - `position` (object, optional): `{ bottom: number, right: number }`. Default `{ bottom: 24, right: 24 }`.
  - `buttonSelector` (string, optional): CSS selector for an existing button.

If you set `window.AgentEmbedConfig` to a config object **before** the script loads, the script will call `init()` automatically with that config. Otherwise, call `AgentEmbed.init(config)` after the script loads.

**Example (script + init overrides):**

```html
<script src="https://your-app.com/embed/agent-embed.js"></script>
<script>
  AgentEmbed.init({
    baseUrl: "https://your-app.com",
    customerId: "salesforce",
    features: { hover: true, preview: true, toc: false },
    position: { bottom: 20, right: 20 },
  });
</script>
```

## PostMessage API

The embed and the host page communicate via `window.postMessage`. **Always validate `event.origin`** in your listener before handling messages.

### Messages from embed to host

**`agent-embed-resize`**

- **Payload:** `{ type: "agent-embed-resize", open: boolean, width: number, height: number }`
- **When:** Sent when the user opens or closes the chat panel. When the chat is closed, the embed may send `open: false` and zero width/height so the host can hide the iframe and show the floating button.
- **Host usage:** Resize or hide the iframe based on `width` and `height`; show the floating button when the chat is closed (`!open` or zero size).

### Messages from host to embed

**`agent-embed-open`**

- **Payload:** `{ type: "agent-embed-open" }`
- **Effect:** Opens or focuses the chat panel inside the iframe.
- **When:** Send when the user clicks your floating button (or custom trigger).

**Example (host listener):**

```javascript
window.addEventListener("message", function (e) {
  if (e.origin !== "https://your-app.com") return; // validate origin
  if (e.data && e.data.type === "agent-embed-resize") {
    var open = e.data.open, w = e.data.width, h = e.data.height;
    if (!open || (w === 0 && h === 0)) {
      // hide iframe, show button
    } else {
      // resize iframe, hide button
    }
  }
});
```

## Without the loader (raw iframe)

You can embed the widget without the loader script by creating the iframe yourself. You are then responsible for:

1. Setting the iframe `src` to `{baseUrl}/{customerId}?embed=1` and optional `&hover=0|1&preview=0|1&toc=0|1`.
2. Providing a floating button (or other trigger) that sends `agent-embed-open` to the iframe.
3. Listening for `agent-embed-resize` and resizing or hiding the iframe and toggling the button.

**Minimal snippet:**

```html
<button id="open-chat" type="button" aria-label="Open chat">Open chat</button>
<iframe
  id="agent-embed"
  title="Agentforce chat"
  src="https://your-app.com/salesforce?embed=1"
  style="position: fixed; bottom: 24px; right: 24px; width: 0; height: 0; border: none; display: none;"
></iframe>
<script>
  (function () {
    var iframe = document.getElementById("agent-embed");
    var btn = document.getElementById("open-chat");
    var allowedOrigin = "https://your-app.com";
    window.addEventListener("message", function (e) {
      if (e.origin !== allowedOrigin || !e.data || e.data.type !== "agent-embed-resize") return;
      var open = e.data.open, w = e.data.width, h = e.data.height;
      if (!open || (w === 0 && h === 0)) {
        iframe.style.width = "0"; iframe.style.height = "0"; iframe.style.display = "none";
        btn.style.display = "block";
      } else {
        iframe.style.width = w + "px"; iframe.style.height = h + "px"; iframe.style.display = "block";
        btn.style.display = "none";
      }
    });
    btn.addEventListener("click", function () {
      iframe.style.width = "420px"; iframe.style.height = "700px"; iframe.style.display = "block";
      btn.style.display = "none";
      iframe.contentWindow.postMessage({ type: "agent-embed-open" }, "*");
    });
  })();
</script>
```

## Feature toggles reference

| Feature   | URL param | Effect when disabled |
|----------|-----------|------------------------|
| Hover    | `hover=0` | No hover card on citations; “View Source” still clickable. |
| Preview  | `preview=0` | Clicking a citation opens the article in a new browser tab instead of the in-page modal. |
| TOC      | `toc=0`   | Citation modal does not show “Show table of contents” or the TOC sidebar. |

## Requirements and constraints

- **customerId** must exist in the app’s customer configuration (e.g. `server/config/customers.json`). If the customer is missing, the embed will show a “Customer not found” or loading state.
- **Cross-origin:** If the embed is on a different origin than the app, the host page and the iframe are cross-origin. The app does not require CORS for the embed to load (the iframe loads the full SPA). For postMessage, validate `event.origin` on the host to avoid accepting messages from other origins.
- **Cookies / session:** Session and auth are handled inside the iframe (same as the full app). If your app uses cookies, ensure the embed is served from a domain/path that can receive them if needed.

## Troubleshooting

- **Chat not loading / blank iframe**
  - Confirm the URL includes `/{customerId}?embed=1` (e.g. `https://your-app.com/salesforce?embed=1`). A URL like `/?embed=1` without a customer path will show the empty landing page, not the chat.
  - Verify the customer ID exists in the server’s customer config.

- **Resize or floating button not working**
  - Ensure the host page listens for `message` events and handles `agent-embed-resize` (resize iframe, show/hide button).
  - When the user clicks the button, the host must send `agent-embed-open` to the iframe’s `contentWindow` with `postMessage`.

- **Common mistakes**
  - Using the wrong **baseUrl** (e.g. missing protocol, or pointing to a different environment).
  - Omitting **customerId** from the path (e.g. `src="/?embed=1"` instead of `src="/salesforce?embed=1"`).
  - Loading the script before the DOM is ready (the script appends the iframe/button to `document.body`; load the script at the end of `<body>` or after DOM ready).
