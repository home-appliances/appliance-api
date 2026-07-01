#!/bin/bash
set -e

VERSION=${VERSION:-latest}
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$ARCH" in
  x86_64) ARCH="amd64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *) echo "unsupported architecture: $ARCH" && exit 1 ;;
esac

# set install dir
if [ "$(id -u)" -ne 0 ] && [ -z "$INSTALL_DIR" ]; then
  INSTALL_DIR="$HOME/.local/bin"
  mkdir -p "$INSTALL_DIR"

  PATH_LINE='export PATH="$HOME/.local/bin:$PATH"'
  add_path() { [ -f "$1" ] && grep -q '\.local/bin' "$1" || echo "$PATH_LINE" >> "$1"; }
  if [ "$OS" = "darwin" ]; then
    add_path "$HOME/.zshrc"
    add_path "$HOME/.bash_profile"
  else
    add_path "$HOME/.bashrc"
  fi

  export PATH="$INSTALL_DIR:$PATH"
else
  INSTALL_DIR=${INSTALL_DIR:-/usr/local/bin}
fi

# resolve download url and aliases from manifest
if [ "$VERSION" = "latest" ]; then
  MANIFEST_URL="https://dist.inference.sh/cli/manifest.json"
else
  MANIFEST_URL="https://dist.inference.sh/cli/${VERSION}/manifest.json"
fi
MANIFEST=$(curl -fsSL "$MANIFEST_URL") || { echo "error: version $VERSION not found"; exit 1; }
URL=$(echo "$MANIFEST" | grep -o "\"$OS-$ARCH\":{[^}]*}" | grep -o 'https[^"]*')

# parse aliases from manifest. defaults to "infsh" when not specified or
# when installing a pinned older version that predates the field.
if [ -n "$MANIFEST" ]; then
  ALIASES=$(echo "$MANIFEST" | grep -o '"aliases":\[[^]]*\]' | grep -o '"[^"]*"' | grep -v '^"aliases"$' | tr -d '"' | tr '\n' ' ')
fi
if [ -z "$ALIASES" ]; then
  ALIASES="belt infsh"
fi

NAME=$(basename "$URL" .tar.gz)
TARBALL_NAME=$(basename "$URL")
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "downloading cli $VERSION for $OS-$ARCH..."
curl -fsSL "$URL" -o "$TMP/$TARBALL_NAME"

# verify checksum
echo "verifying checksum..."
  CHECKSUMS_URL=$(echo "$MANIFEST_URL" | sed 's/manifest\.json/checksums.txt/')
  curl -fsSL "$CHECKSUMS_URL" -o "$TMP/checksums.txt"
  EXPECTED=$(grep "$TARBALL_NAME" "$TMP/checksums.txt" | awk '{print $1}')
  if [ -z "$EXPECTED" ]; then
    echo "warning: no checksum found for $TARBALL_NAME, skipping verification"
  else
    if command -v sha256sum >/dev/null 2>&1; then
      ACTUAL=$(sha256sum "$TMP/$TARBALL_NAME" | awk '{print $1}')
    elif command -v shasum >/dev/null 2>&1; then
      ACTUAL=$(shasum -a 256 "$TMP/$TARBALL_NAME" | awk '{print $1}')
    else
      echo "warning: no sha256sum or shasum found, skipping verification"
      ACTUAL="$EXPECTED"
    fi
    if [ "$ACTUAL" != "$EXPECTED" ]; then
      echo "error: checksum mismatch!"
      echo "  expected: $EXPECTED"
      echo "  got:      $ACTUAL"
      echo "the download may be corrupted or tampered with."
      exit 1
    fi
    echo "checksum verified."
  fi

  # verify cosign signature on checksums (optional)
  DIST_BASE=$(echo "$MANIFEST_URL" | sed 's/\/manifest\.json//')
  if command -v cosign >/dev/null 2>&1; then
    echo "verifying signature..."
    BUNDLE="$TMP/checksums.txt.bundle"
    curl -fsSL "$DIST_BASE/checksums.txt.bundle" -o "$BUNDLE" 2>/dev/null && \
    cosign verify-blob "$TMP/checksums.txt" \
      --bundle "$BUNDLE" \
      --key "$DIST_BASE/cosign.pub" && \
    echo "signature verified." || \
    echo "warning: signature verification failed, continuing with checksum-only."
  fi

tar -xzf "$TMP/$TARBALL_NAME" -C "$TMP"
BIN="$TMP/$NAME"

chmod +x "$BIN"
# Clear the real binary plus all aliases before installing.
rm -f "$INSTALL_DIR/inferencesh"
for alias in $ALIASES; do
  rm -f "$INSTALL_DIR/$alias"
done
mv "$BIN" "$INSTALL_DIR/inferencesh"
# Recreate aliases as symlinks (relative target so the link survives moves).
for alias in $ALIASES; do
  ln -sf inferencesh "$INSTALL_DIR/$alias"
done

echo "installed to $INSTALL_DIR"
ALIAS_LIST=$(echo "$ALIASES" | tr ' ' ',' | sed 's/,$//')
echo "run 'inferencesh' or aliases: $ALIAS_LIST"