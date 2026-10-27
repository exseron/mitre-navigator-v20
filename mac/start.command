#!/bin/bash
# ATT&CK TTP Panel — macOS'ta kaynak koddan çalıştırma.
# Finder'da çift tıklayarak açabilirsiniz.
set -e
cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  # Homebrew ile kurulan Node.js, Finder'dan açılan oturumda PATH'te olmayabilir
  for p in /opt/homebrew/bin /usr/local/bin; do
    [ -x "$p/node" ] && export PATH="$p:$PATH"
  done
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[HATA] Node.js bulunamadı. https://nodejs.org adresinden LTS sürümünü ya da 'brew install node' ile kurun."
  read -r -p "Kapatmak için Enter'a basın…"
  exit 1
fi

if [ ! -d node_modules/electron ]; then
  echo "Bağımlılıklar kuruluyor, ilk çalıştırmada birkaç dakika sürebilir…"
  npm install
fi

npm start
