// src/utils/resolveArticleImages.ts

/**
 * After harmonized article HTML is injected via innerHTML, resolve <img> sources so images load.
 *
 * DITA-published topics reference images with relative paths (e.g. `../Images/APD-7334_Figure1.png`)
 * that resolve against the app origin and 404. The harmonized `get-hudmo` response solves this by:
 *   - tagging each <img> with `data-dccid="<image dccid>"`, and
 *   - returning an `attributes.assets` map of `{ [dccid]: "https://…cdn…/image.png" }`.
 *
 * So the correct fix is to rewrite each relative <img src> to `assets[data-dccid]`. When no assets
 * map is available we fall back to resolving relative paths against the article `sourceUrl` base.
 * Absolute/CDN/data URLs are left untouched, so this is a no-op when content already returns
 * fully-qualified image URLs.
 *
 * Also sets referrerPolicy=no-referrer and hides images that still fail to load, so a broken image
 * icon doesn't clutter the article body.
 */
export function resolveArticleImages(
  container: HTMLElement | null,
  opts: { sourceUrl?: string | null; assets?: Record<string, string> | null } = {}
): void {
  if (!container) return;
  const base = opts.sourceUrl ?? undefined;
  const assets = opts.assets ?? undefined;
  const imgs = container.querySelectorAll("img");
  imgs.forEach((img) => {
    img.setAttribute("referrerpolicy", "no-referrer");

    // Preferred path: resolve by data-dccid against the assets map.
    const dccid = img.getAttribute("data-dccid");
    if (assets && dccid && typeof assets[dccid] === "string" && assets[dccid]) {
      img.src = assets[dccid];
      attachErrorHandler(img);
      return;
    }

    const raw = img.getAttribute("src") ?? "";
    if (!raw) return;

    // Leave absolute, protocol-relative, and data/blob URLs alone.
    if (/^(https?:)?\/\//i.test(raw) || /^(data|blob):/i.test(raw)) {
      attachErrorHandler(img);
      return;
    }

    // Relative path with no asset match: resolve against the article's source URL when available.
    if (base) {
      try {
        img.src = new URL(raw, base).href;
      } catch {
        /* leave as-is if base is not a valid URL */
      }
    }
    attachErrorHandler(img);
  });
}

function attachErrorHandler(img: HTMLImageElement): void {
  img.addEventListener(
    "error",
    () => {
      img.style.display = "none";
    },
    { once: true }
  );
}
