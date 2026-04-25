#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="${APP_NAME:-Run-Calc}"
VERSION="${VERSION:-dev}"
ARCH="${ARCH:-x86_64}"

BIN_PATH="${ROOT_DIR}/build/bin/${APP_NAME}"
ICON_PATH="${ROOT_DIR}/frontend/src/assets/images/icons/hare-calc-256.png"
APPIMAGE_BUILD_DIR="${ROOT_DIR}/build/appimage"
APPDIR="${APPIMAGE_BUILD_DIR}/AppDir"
TOOLS_DIR="${APPIMAGE_BUILD_DIR}/tools"
RELEASE_DIR="${ROOT_DIR}/release"

if [[ ! -x "${BIN_PATH}" ]]; then
  echo "Binary not found or not executable: ${BIN_PATH}" >&2
  exit 1
fi

if [[ ! -f "${ICON_PATH}" ]]; then
  echo "Icon not found: ${ICON_PATH}" >&2
  exit 1
fi

mkdir -p "${APPDIR}" "${TOOLS_DIR}" "${RELEASE_DIR}"
rm -rf "${APPDIR}"
mkdir -p "${APPDIR}/usr/bin" "${APPDIR}/usr/share/icons/hicolor/256x256/apps" "${APPDIR}/usr/share/applications"

cp "${BIN_PATH}" "${APPDIR}/usr/bin/${APP_NAME}"
cp "${ICON_PATH}" "${APPDIR}/${APP_NAME}.png"
cp "${ICON_PATH}" "${APPDIR}/usr/share/icons/hicolor/256x256/apps/${APP_NAME}.png"

DESKTOP_FILE="${APPDIR}/${APP_NAME}.desktop"
cat > "${DESKTOP_FILE}" <<EOF
[Desktop Entry]
Type=Application
Name=${APP_NAME}
Exec=${APP_NAME}
Icon=${APP_NAME}
Categories=Utility;
Terminal=false
EOF
cp "${DESKTOP_FILE}" "${APPDIR}/usr/share/applications/${APP_NAME}.desktop"

LINUXDEPLOY="${TOOLS_DIR}/linuxdeploy-${ARCH}.AppImage"
GTK_PLUGIN="${TOOLS_DIR}/linuxdeploy-plugin-gtk.sh"

download_with_fallback() {
  local output_path="$1"
  shift

  for url in "$@"; do
    if curl -fsSL "$url" -o "$output_path"; then
      return 0
    fi
  done

  return 1
}

if [[ ! -f "${LINUXDEPLOY}" ]]; then
  download_with_fallback "${LINUXDEPLOY}" \
    "https://github.com/linuxdeploy/linuxdeploy/releases/download/continuous/linuxdeploy-${ARCH}.AppImage" \
    "https://github.com/linuxdeploy/linuxdeploy/releases/latest/download/linuxdeploy-${ARCH}.AppImage"
fi
if [[ ! -f "${GTK_PLUGIN}" ]]; then
  download_with_fallback "${GTK_PLUGIN}" \
    "https://raw.githubusercontent.com/linuxdeploy/linuxdeploy-plugin-gtk/master/linuxdeploy-plugin-gtk.sh" \
    "https://raw.githubusercontent.com/linuxdeploy/linuxdeploy-plugin-gtk/main/linuxdeploy-plugin-gtk.sh"
fi

if [[ ! -f "${LINUXDEPLOY}" ]]; then
  echo "Failed to download linuxdeploy AppImage" >&2
  exit 1
fi

if [[ ! -f "${GTK_PLUGIN}" ]]; then
  echo "Failed to download linuxdeploy GTK plugin" >&2
  exit 1
fi

chmod +x "${LINUXDEPLOY}" "${GTK_PLUGIN}"

pushd "${ROOT_DIR}" >/dev/null
rm -f ./*.AppImage

export VERSION
export ARCH
export PATH="${TOOLS_DIR}:${PATH}"

"${LINUXDEPLOY}" \
  --appdir "${APPDIR}" \
  --desktop-file "${DESKTOP_FILE}" \
  --icon-file "${APPDIR}/${APP_NAME}.png" \
  --executable "${APPDIR}/usr/bin/${APP_NAME}" \
  --plugin gtk \
  --output appimage

APPIMAGE_FILE="$(find . -maxdepth 1 -type f -name "*.AppImage" | head -n 1)"
if [[ -z "${APPIMAGE_FILE}" ]]; then
  echo "AppImage was not produced" >&2
  exit 1
fi

TARGET_NAME="${APP_NAME}-${VERSION}-linux-${ARCH}.AppImage"
mv "${APPIMAGE_FILE}" "${RELEASE_DIR}/${TARGET_NAME}"

popd >/dev/null

echo "Created ${RELEASE_DIR}/${TARGET_NAME}"
