#!/usr/bin/env bash
# Upload the site to the Netlify site 'womenonrecord', served at www.womenonrecord.net. Needs NETLIFY_PAT.
# Not needed once the Netlify site is linked to the GitHub repository.
set -euo pipefail
cd "$(dirname "$0")/.."
# Translations first, then pages: the pages carry a fingerprint of every file
# they load, js/i18n.js included, so they must be written last.
python3 scripts/build_i18n.py --check
python3 scripts/build_pages.py
python3 scripts/build_pages.py --check
python3 scripts/check.py
Z=$(mktemp -d)/site.zip
zip -qr "$Z" . -x '.git/*' '.github/*' 'scripts/*' 'i18n/*' 'site/*' 'node_modules/*' 'package.json' 'package-lock.json'
curl -sf -X POST -H "Authorization: Bearer $NETLIFY_PAT" -H "Content-Type: application/zip" \
  --data-binary @"$Z" https://api.netlify.com/api/v1/sites/98f16191-ea31-4c2f-88a2-3f0f5d01bc1a/deploys \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('deploy',d['id'],d['state'])"
