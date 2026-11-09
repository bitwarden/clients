# Linux environment for the e2e suites, mirroring CI (ubuntu-24.04 + xvfb-run, see
# .github/workflows/test-e2e-usdev.yml). Driven by isolate.mjs; the repo is mounted, not copied.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    RUSTUP_HOME=/opt/rustup \
    CARGO_HOME=/opt/cargo \
    PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright \
    PATH=/opt/cargo/bin:$PATH \
    NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

# Native module build (desktop_native) and the virtual display.
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential ca-certificates curl git pkg-config \
      libdbus-1-dev libsecret-1-dev libglib2.0-dev libwayland-dev libx11-dev libxss-dev \
      xvfb xauth \
    && rm -rf /var/lib/apt/lists/*

# Hash of the host's CA bundle, so a rotated CA rebuilds the layer that trusts it.
ARG HOST_CA_SHA

# Trusts the host's CAs too, when a TLS-intercepting proxy (e.g. endpoint protection) re-signs
# traffic. update-ca-certificates takes one certificate per file, so split the bundle.
RUN --mount=type=secret,id=host_ca,required=false \
    if [ -f /run/secrets/host_ca ]; then \
      awk '/BEGIN CERT/ { n++ } n { print > ("/usr/local/share/ca-certificates/host-" n ".crt") }' /run/secrets/host_ca \
      && update-ca-certificates; \
    fi

ARG NODE_MAJOR
RUN curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Toolchains come from desktop_native/rust-toolchain.toml at build time, cached in a volume.
RUN curl -fsSL https://sh.rustup.rs | sh -s -- -y --no-modify-path --profile minimal --default-toolchain none

# System libraries for Chromium.
ARG PLAYWRIGHT_VERSION
RUN npx -y "playwright@${PLAYWRIGHT_VERSION}" install-deps chromium \
    && rm -rf /var/lib/apt/lists/*

# Electron also needs GTK and the desktop integrations Chromium leaves out.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgtk-3-0t64 libnotify4 libsecret-1-0 libxtst6 libxss1 libnss3 libgbm1 libasound2t64 \
    && rm -rf /var/lib/apt/lists/*
