/**
 * Records which modules an app imports while it renders a URL, and turns
 * those into `<link>` tags through the CSS manifest.
 *
 * `trackDynamicImports` (vite-plugin.ts) rewrites every `import()` in
 * SSR builds to call the `__vite_ember_ssr_import__` global with the
 * imported module's path first. The global is installed once per
 * process here and appends to the set of the render in progress.
 *
 * Tracking is a plain module-level set, not `AsyncLocalStorage`. Ember
 * schedules route loading through Backburner and RSVP, whose queues are
 * created once at startup, so the async context of a render does not
 * reach the `import()` call. Renders are serialised per worker, so one
 * set per process is enough.
 */

import { IMPORT_HOOK_GLOBAL, type CssManifest } from './vite-plugin.js';

let current: Set<string> | null = null;
let installed = false;

function installImportHook(): void {
  if (installed) return;
  installed = true;
  Object.defineProperty(globalThis, IMPORT_HOOK_GLOBAL, {
    value: (id: string) => {
      current?.add(id);
    },
    writable: true,
    configurable: true,
  });
}

/**
 * Starts recording the module paths the app imports. Returns the set
 * that the import hook appends to until `stopImportTracking()`.
 */
export function startImportTracking(): Set<string> {
  installImportHook();
  current = new Set<string>();
  return current;
}

export function stopImportTracking(): void {
  current = null;
}

/**
 * Builds stylesheet links for every tracked import present in the
 * manifest, in import order, without duplicates.
 */
export function buildCssLinks(
  manifest: CssManifest | null | undefined,
  imports: Iterable<string>,
): string {
  if (!manifest) return '';
  const seen = new Set<string>();
  const links: string[] = [];
  for (const id of imports) {
    const cssFiles = manifest[id];
    if (!cssFiles) continue;
    for (const href of cssFiles) {
      if (seen.has(href)) continue;
      seen.add(href);
      links.push(`<link rel="stylesheet" href="${href}">`);
    }
  }
  return links.join('');
}
