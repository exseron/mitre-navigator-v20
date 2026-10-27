#!/bin/bash
# ATT&CK TTP Panel — macOS paketi (.dmg + .zip, Universal: Apple Silicon + Intel)
#
#   ./mac/build.sh                      ad-hoc imzalı paket
#   MAC_SIGN_IDENTITY="Developer ID Application: Ad (TEAMID)" ./mac/build.sh
#                                       Developer ID ile imzalı paket
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$(uname -s)" != "Darwin" ]; then
  echo "[HATA] macOS paketi yalnızca macOS üzerinde oluşturulabilir (GitHub Actions iş akışını da kullanabilirsiniz)."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[HATA] Node.js bulunamadı. https://nodejs.org ya da 'brew install node'"
  exit 1
fi

echo "[1/2] Bağımlılıklar kuruluyor…"
npm ci || npm install

echo "[2/2] macOS paketi oluşturuluyor…"
EXTRA=()
if [ -n "${MAC_SIGN_IDENTITY:-}" ]; then
  EXTRA+=("-c.mac.identity=${MAC_SIGN_IDENTITY}")
fi
npx electron-builder --config mac/electron-builder.yml --mac "${EXTRA[@]+"${EXTRA[@]}"}"

echo
echo "Tamamlandı. Çıktılar: dist/mac"
echo "  - ATTACK-TTP-Panel-*-mac-universal.dmg  (sürükle-bırak kurulum)"
echo "  - ATTACK-TTP-Panel-*-mac-universal.zip"
open dist/mac || true
