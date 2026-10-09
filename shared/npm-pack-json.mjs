// WHAT `npm pack --dry-run --json` SAYS IT WOULD SEND, WHICHEVER npm SAID IT.
//
// It lives in shared/ rather than scripts/lib/ because scripts/before-publish.mjs
// ships in the package and scripts/lib/ does not, so an import from there would
// dangle in the tarball.
//
// npm 10 prints an array with one manifest per package:
//   [ { "name": "agentbox-app", "files": [ { "path": "LICENSE" }, ... ] } ]
// npm 12 prints an object keyed by package name instead:
//   { "agentbox-app": { "name": "agentbox-app", "files": [ ... ] } }
//
// The publish guard and the package privacy test used to take the text from
// the first `[` onward. Under npm 12 that first `[` is the opening of "files",
// so the parse threw (measured 2026-10-09 on npm 12.2.0), the guard fell back
// to refusing every uncommitted packable file, and the privacy test did not
// load at all.
//
// Lifecycle scripts can print above the JSON (a `prepack` build, npm notices
// on older versions), so this tries each line that opens with `[` or `{` as
// the start of the document and keeps the first one that parses to the end.

/** Every manifest in the output, in the order npm printed them. */
export function packManifests(raw) {
  const doc = parseFromSomeLine(String(raw ?? ''));
  const list = Array.isArray(doc) ? doc
    : doc && typeof doc === 'object' && Array.isArray(doc.files) ? [doc]
    : doc && typeof doc === 'object' ? Object.values(doc)
    : [];
  const manifests = list.filter((m) => m && typeof m === 'object' && Array.isArray(m.files));
  if (!manifests.length) throw new Error('npm pack --json printed no package manifest');
  return manifests;
}

/** The single package this repository packs. */
export function packManifest(raw) {
  return packManifests(raw)[0];
}

/** The paths npm would put in the tarball. */
export function packedPaths(raw) {
  return new Set(packManifests(raw).flatMap((m) => m.files.map((f) => f.path)));
}

function parseFromSomeLine(text) {
  let at = 0;
  while (at <= text.length) {
    const line = text.slice(at).replace(/^[ \t]+/, '');
    if (line[0] === '[' || line[0] === '{') {
      try { return JSON.parse(line); } catch {}
    }
    const next = text.indexOf('\n', at);
    if (next === -1) break;
    at = next + 1;
  }
  throw new Error('npm pack --json printed nothing that parses as JSON');
}
