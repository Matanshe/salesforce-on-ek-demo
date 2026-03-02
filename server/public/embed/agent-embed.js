/**
 * Agent Embed Loader
 * Drop-in script for embedding the Agentforce chat widget on any site.
 * Include: <script src="https://your-app.com/embed/agent-embed.js" data-base-url="..." data-customer-id="..."></script>
 * Or call AgentEmbed.init({ baseUrl, customerId, features: { hover, preview, toc }, position: { bottom, right } });
 */
(function () {
  "use strict";

  function parseFeatures(value) {
    var defaults = { hover: true, preview: true, toc: true };
    if (value == null || value === "") return defaults;
    if (typeof value === "object" && value !== null) {
      return {
        hover: value.hover !== false,
        preview: value.preview !== false,
        toc: value.toc !== false,
      };
    }
    var s = String(value).toLowerCase().replace(/\s/g, "");
    if (!s) return defaults;
    var list = s.split(",");
    return {
      hover: list.indexOf("hover") !== -1,
      preview: list.indexOf("preview") !== -1,
      toc: list.indexOf("toc") !== -1,
    };
  }

  function getConfigFromScript() {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i];
      var src = s.getAttribute("src") || "";
      if (src.indexOf("agent-embed.js") !== -1) {
        return {
          baseUrl: (s.getAttribute("data-base-url") || "").replace(/\/$/, ""),
          customerId: s.getAttribute("data-customer-id") || "",
          features: parseFeatures(s.getAttribute("data-features")),
          position: {
            bottom: parseInt(s.getAttribute("data-bottom"), 10) || 24,
            right: parseInt(s.getAttribute("data-right"), 10) || 24,
          },
          buttonSelector: s.getAttribute("data-button-selector") || null,
        };
      }
    }
    return null;
  }

  function buildEmbedUrl(baseUrl, customerId, features) {
    var base = baseUrl + "/" + encodeURIComponent(customerId);
    var params = ["embed=1", "hover=" + (features.hover ? "1" : "0"), "preview=" + (features.preview ? "1" : "0"), "toc=" + (features.toc ? "1" : "0")];
    return base + "?" + params.join("&");
  }

  function init(config) {
    var c = config || window.AgentEmbedConfig || getConfigFromScript();
    if (!c || !c.baseUrl || !c.customerId) {
      console.warn("[AgentEmbed] baseUrl and customerId are required.");
      return;
    }
    var baseUrl = String(c.baseUrl).replace(/\/$/, "");
    var customerId = String(c.customerId);
    var features = parseFeatures(c.features);
    var position = c.position || { bottom: 24, right: 24 };
    var bottom = position.bottom != null ? position.bottom : 24;
    var right = position.right != null ? position.right : 24;
    var buttonSelector = c.buttonSelector || null;

    var embedId = "agent-embed-iframe-" + Math.random().toString(36).slice(2, 9);
    var btnId = "agent-embed-btn-" + Math.random().toString(36).slice(2, 9);

    var iframe = document.createElement("iframe");
    iframe.id = embedId;
    iframe.title = "Agentforce chat";
    iframe.src = buildEmbedUrl(baseUrl, customerId, features);
    iframe.setAttribute("style",
      "position: fixed; bottom: " + bottom + "px; right: " + right + "px; border: none; box-shadow: 0 4px 20px rgba(0,0,0,0.15); border-radius: 8px; transition: width 0.2s, height 0.2s;");
    document.body.appendChild(iframe);

    var btn = buttonSelector ? document.querySelector(buttonSelector) : null;
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.id = btnId;
      btn.setAttribute("aria-label", "Open Agentforce chat");
      btn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\" style=\"margin: auto;\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z\"/></svg>";
      btn.setAttribute("style",
        "display: none; position: fixed; bottom: " + bottom + "px; right: " + right + "px; z-index: 9999; width: 56px; height: 56px; border-radius: 50%; background: #0176d3; color: white; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); align-items: center; justify-content: center;");
      document.body.appendChild(btn);
    }

    function setIframeSize(w, h) {
      iframe.style.width = w + "px";
      iframe.style.height = h + "px";
      iframe.style.display = w && h ? "block" : "none";
    }
    function setButtonVisible(show) {
      btn.style.display = show ? "flex" : "none";
    }

    window.addEventListener("message", function (e) {
      if (e.data && e.data.type === "agent-embed-resize") {
        var open = e.data.open;
        var w = e.data.width;
        var h = e.data.height;
        if (!open || (w === 0 && h === 0)) {
          setIframeSize(0, 0);
          setButtonVisible(true);
        } else {
          setIframeSize(w, h);
          setButtonVisible(false);
        }
      }
    });

    btn.addEventListener("click", function () {
      setIframeSize(420, 700);
      setButtonVisible(false);
      try {
        iframe.contentWindow.postMessage({ type: "agent-embed-open" }, "*");
      } catch (err) {}
    });

    setIframeSize(80, 80);
  }

  if (typeof window !== "undefined") {
    window.AgentEmbed = { init: init };
    var scriptConfig = getConfigFromScript();
    if (window.AgentEmbedConfig) {
      init(window.AgentEmbedConfig);
    } else if (scriptConfig && scriptConfig.baseUrl && scriptConfig.customerId) {
      init(scriptConfig);
    }
  }
})();
