#!/usr/bin/env bash
set -euo pipefail

# Assemble self-contained ARM64 runtime assets for WPhone Android APK (>300MB):
# 1. Cross-compile / bundle libproot.so + libproot-loader.so into app/src/main/jniLibs/arm64-v8a/
# 2. Cross-compile Box64 (ARM64 DynaRec)
# 3. Bootstrap Ubuntu 24.04 ARM64 minimal userspace + Wine WoW64 + Mesa/X11/Pulse libs
# 4. Pack wphone-rootfs-arm64.tar.xz + runtime-manifest.json into app/src/main/assets/runtime/

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
JNILIBS_DIR="$ANDROID_DIR/app/src/main/jniLibs/arm64-v8a"
ASSETS_RUNTIME_DIR="$ANDROID_DIR/app/src/main/assets/runtime"
BUILD_TMP="${RUNNER_TEMP:-/tmp}/wphone-runtime-build"

mkdir -p "$JNILIBS_DIR" "$ASSETS_RUNTIME_DIR" "$BUILD_TMP"

echo "==> [1/5] Installing host cross-build dependencies"
sudo apt-get update -qq
sudo apt-get install -y -qq \
  build-essential git cmake make pkg-config python3 curl jq xz-utils file unzip patchelf \
  gcc-aarch64-linux-gnu g++-aarch64-linux-gnu \
  qemu-user-static binfmt-support

NDK_HOME="${ANDROID_NDK_HOME:-${ANDROID_NDK_ROOT:-}}"
if [ -z "$NDK_HOME" ] && [ -n "${ANDROID_HOME:-}" ]; then
  NDK_HOME="$(ls -d "$ANDROID_HOME"/ndk/* 2>/dev/null | sort -V | tail -n1 || true)"
fi
if [ -z "$NDK_HOME" ] || [ ! -d "$NDK_HOME" ]; then
  echo "ERROR: ANDROID_NDK_HOME not found." >&2
  exit 1
fi
echo "Using Android NDK: $NDK_HOME"

echo "==> [2/5] Preparing Android Bionic PRoot (libproot.so + loader) for arm64-v8a (API 24+)"
PROOT_OUT="$BUILD_TMP/proot-out"
mkdir -p "$PROOT_OUT"

if git clone --depth 1 https://github.com/green-green-avk/build-proot-android.git "$BUILD_TMP/build-proot-android"; then
  pushd "$BUILD_TMP/build-proot-android" >/dev/null
  # Configure for NDK r27 & API 24 arm64-v8a
  if [ -f config ]; then
    sed -i "s|^NDK=.*|NDK=\"$NDK_HOME\"|" config || true
    sed -i "s|^ARCHS=.*|ARCHS=\"arm64-v8a\"|" config || true
    sed -i "s|^ANDROID_API=.*|ANDROID_API=24|" config || true
  fi
  if bash ./build.sh; then
    FOUND_PROOT="$(find . -type f \( -name 'proot' -o -name 'libproot.so' \) | head -n1 || true)"
    FOUND_LOADER="$(find . -type f \( -name 'loader' -o -name 'libproot-loader.so' \) ! -name '*32*' | head -n1 || true)"
    FOUND_LOADER32="$(find . -type f \( -name 'loader32' -o -name 'loader-m32' -o -name 'libproot-loader32.so' \) | head -n1 || true)"
    [ -n "$FOUND_PROOT" ] && cp "$FOUND_PROOT" "$JNILIBS_DIR/libproot.so"
    [ -n "$FOUND_LOADER" ] && cp "$FOUND_LOADER" "$JNILIBS_DIR/libproot-loader.so"
    [ -n "$FOUND_LOADER32" ] && cp "$FOUND_LOADER32" "$JNILIBS_DIR/libproot-loader32.so"
  else
    echo "build-proot-android source build returned non-zero; checking upstream prebuilt release fallback."
  fi
  popd >/dev/null
fi

if [ ! -s "$JNILIBS_DIR/libproot.so" ]; then
  echo "Fetching Termux-compatible prebuilt proot + talloc aarch64 deb..."
  mkdir -p "$BUILD_TMP/termux-deb"
  pushd "$BUILD_TMP/termux-deb" >/dev/null
  PACKAGES_IDX="https://packages.termux.dev/apt/termux-main/dists/stable/main/binary-aarch64/Packages"
  curl -fsSL "$PACKAGES_IDX" -o Packages
  PROOT_DEB="$(awk '/^Package: proot$/{f=1} f && /^Filename:/{print $2; exit}' Packages)"
  TALLOC_DEB="$(awk '/^Package: libtalloc$/{f=1} f && /^Filename:/{print $2; exit}' Packages)"
  curl -fsSL "https://packages.termux.dev/apt/termux-main/$PROOT_DEB" -o proot.deb
  curl -fsSL "https://packages.termux.dev/apt/termux-main/$TALLOC_DEB" -o talloc.deb
  mkdir -p unpack
  dpkg-deb -x proot.deb unpack
  dpkg-deb -x talloc.deb unpack
  cp unpack/data/data/com.termux/files/usr/bin/proot "$JNILIBS_DIR/libproot.so"
  if [ -f unpack/data/data/com.termux/files/usr/libexec/proot/loader ]; then
    cp unpack/data/data/com.termux/files/usr/libexec/proot/loader "$JNILIBS_DIR/libproot-loader.so"
  fi
  TALLOC_SO="$(find unpack -name 'libtalloc.so*' | head -n1 || true)"
  if [ -n "$TALLOC_SO" ]; then
    cp "$TALLOC_SO" "$JNILIBS_DIR/libtalloc.so"
    patchelf --set-soname libtalloc.so "$JNILIBS_DIR/libtalloc.so" || true
    patchelf --replace-needed libtalloc.so.2 libtalloc.so "$JNILIBS_DIR/libproot.so" || true
  fi
  popd >/dev/null
fi

chmod 755 "$JNILIBS_DIR"/*.so || true
file "$JNILIBS_DIR/libproot.so"
if ! file "$JNILIBS_DIR/libproot.so" | grep -qiE "aarch64|ARM aarch64"; then
  echo "ERROR: libproot.so is not a valid aarch64 ELF binary!" >&2
  exit 1
fi

echo "==> [3/5] Cross-compiling Box64 (ARM64 DynaRec)"
git clone --depth 1 https://github.com/ptitSeb/box64.git "$BUILD_TMP/box64-src"
mkdir -p "$BUILD_TMP/box64-build"
pushd "$BUILD_TMP/box64-build" >/dev/null
cmake ../box64-src \
  -DCMAKE_SYSTEM_NAME=Linux \
  -DCMAKE_SYSTEM_PROCESSOR=aarch64 \
  -DCMAKE_C_COMPILER=aarch64-linux-gnu-gcc \
  -DCMAKE_CXX_COMPILER=aarch64-linux-gnu-g++ \
  -DARM_DYNAREC=ON \
  -DNOGIT=1 \
  -DCMAKE_BUILD_TYPE=Release
make -j"$(nproc)"
aarch64-linux-gnu-strip box64
file box64
popd >/dev/null

echo "==> [4/5] Bootstrapping Ubuntu 24.04 ARM64 Rootfs + Wine WoW64"
ROOTFS="$BUILD_TMP/rootfs"
mkdir -p "$ROOTFS"

UBUNTU_BASE_INDEX="https://cdimage.ubuntu.com/ubuntu-base/releases/24.04/release/"
UBUNTU_TAR="$(curl -fsSL "$UBUNTU_BASE_INDEX" | grep -oE 'ubuntu-base-24\.04(\.[0-9]+)?-base-arm64\.tar\.gz' | sort -V | tail -n1)"
if [ -z "$UBUNTU_TAR" ]; then
  echo "ERROR: Could not locate Ubuntu 24.04 base arm64 tarball." >&2
  exit 1
fi
echo "Downloading $UBUNTU_BASE_INDEX$UBUNTU_TAR ..."
curl -fsSL "$UBUNTU_BASE_INDEX$UBUNTU_TAR" -o "$BUILD_TMP/$UBUNTU_TAR"
sudo tar -xzf "$BUILD_TMP/$UBUNTU_TAR" -C "$ROOTFS"

sudo cp /usr/bin/qemu-aarch64-static "$ROOTFS/usr/bin/"
echo "nameserver 8.8.8.8" | sudo tee "$ROOTFS/etc/resolv.conf" >/dev/null

sudo chroot "$ROOTFS" /usr/bin/qemu-aarch64-static /bin/bash -c "
  set -e
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y --no-install-recommends -qq \
    ca-certificates dash bash coreutils \
    libx11-6 libxext6 libxrender1 libxrandr2 libxcursor1 libxi6 libxfixes3 libxinerama1 \
    libgl1 libegl1 libgles2 libgl1-mesa-dri libfreetype6 libfontconfig1 \
    libpulse0 libasound2t64 libgnutls30t64 libdbus-1-3 zlib1g fonts-liberation
  apt-get clean
  rm -rf /var/lib/apt/lists/* /usr/share/doc/* /usr/share/man/* /usr/share/info/*
"
sudo rm -f "$ROOTFS/usr/bin/qemu-aarch64-static"

# Install Box64 inside rootfs
sudo install -m 0755 "$BUILD_TMP/box64-build/box64" "$ROOTFS/usr/local/bin/box64"

# Download latest Kron4ek Wine WoW64 build (contains wine + built-in C:\windows\system32\notepad.exe)
WINE_API_JSON="$BUILD_TMP/wine-release.json"
curl -fsSL "https://api.github.com/repos/Kron4ek/Wine-Builds/releases/latest" -o "$WINE_API_JSON"
WINE_URL="$(jq -r '[.assets[] | select(.name | test("^wine-[0-9].*-amd64-wow64\\.tar\\.xz$"))][0].browser_download_url' "$WINE_API_JSON")"
WINE_TAG="$(jq -r '.tag_name' "$WINE_API_JSON")"
if [ -z "$WINE_URL" ] || [ "$WINE_URL" = "null" ]; then
  WINE_URL="$(jq -r '[.assets[] | select(.name | test("amd64-wow64\\.tar\\.xz$"))][0].browser_download_url' "$WINE_API_JSON")"
fi
echo "Downloading Wine WoW64 ($WINE_TAG): $WINE_URL"
curl -fsSL "$WINE_URL" -o "$BUILD_TMP/wine-wow64.tar.xz"

sudo mkdir -p "$ROOTFS/opt/wine"
sudo tar -xJf "$BUILD_TMP/wine-wow64.tar.xz" -C "$ROOTFS/opt/wine" --strip-components=1
# Trim unused header/man files to keep APK leaner while keeping all PE/DLL/bin assets intact
sudo rm -rf "$ROOTFS/opt/wine/include" "$ROOTFS/opt/wine/share/man" || true

if [ ! -f "$ROOTFS/opt/wine/bin/wine64" ] && [ -f "$ROOTFS/opt/wine/bin/wine" ]; then
  sudo ln -sf wine "$ROOTFS/opt/wine/bin/wine64"
fi
sudo mkdir -p "$ROOTFS/tmp/.X11-unix" "$ROOTFS/opt/wphone_prefixes" "$ROOTFS/root"
sudo chmod 1777 "$ROOTFS/tmp" "$ROOTFS/tmp/.X11-unix"

echo "==> [5/5] Packing wphone-rootfs-arm64.tar.xz into Android APK assets"
OUT_TAR="$ASSETS_RUNTIME_DIR/wphone-rootfs-arm64.tar.xz"
sudo tar --numeric-owner -C "$ROOTFS" -cf - . | xz -T0 -6 -c > "$OUT_TAR"
ARCHIVE_SHA256="$(sha256sum "$OUT_TAR" | awk '{print $1}')"
ARCHIVE_BYTES="$(stat -c%s "$OUT_TAR")"

cat > "$ASSETS_RUNTIME_DIR/runtime-manifest.json" <<EOF
{
  "bundleVersion": "${WINE_TAG:-1.0.2}",
  "architecture": "arm64-v8a",
  "rootfsAsset": "runtime/wphone-rootfs-arm64.tar.xz",
  "wineTag": "${WINE_TAG:-kron4ek-wow64}",
  "box64Dynarec": "arm64",
  "archiveBytes": $ARCHIVE_BYTES,
  "sha256": "$ARCHIVE_SHA256"
}
EOF

echo "Bundled runtime archive ready: $OUT_TAR ($((ARCHIVE_BYTES / 1024 / 1024)) MB)"
ls -lh "$JNILIBS_DIR" "$ASSETS_RUNTIME_DIR"

# Free temporary build files so Gradle has maximum disk space
sudo rm -rf "$BUILD_TMP"
