# Sustainability Dashboard Package

Built: September 22, 2026

Contents:
- `dashboard.html` — compiled dashboard artifact
- `dashboard.jsx` — source code
- `goodwill-logo.png` — Goodwill branding asset

## Important deployment note

This dashboard uses Zenlytic's live query bridge (`window.runSQL`) to retrieve warehouse data. The compiled HTML is deployable as a Zenlytic artifact, but GitHub Pages alone will not execute the live warehouse queries.

To run it outside Zenlytic, add a backend/API layer that replaces the live query bridge and serves the required data, then update the source accordingly.
