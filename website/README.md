# Agent Inbox public site

Selected direction: B, attention desk. Static HTML/CSS; no application data, scripts, tracking or production dependencies.

Run `node build.mjs` here, then `cf deploy --prebuilt --dry-run` and `cf deploy --prebuilt`. The builder writes the Cloudflare CLI Build Output Specification and copies only the authored public files. It provisions no database, secret or native application resource.

The site links to the existing signed, non-notarized macOS preview and documents its qualification limits. Website publication does not change the app's internal classification or claim release qualification.
