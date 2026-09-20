# Standalone /container deployment for the markdown->PDF tool.
# Usage:
#   docker build -t md-pdf .
#   docker run --rm -v "$PWD:/work" md-pdf input.md [output.pdf]
# (Input/output paths are resolved against /work inside the container.)

FROM node:22-bookworm-slim

# headless Chromium system libraries (puppeteer's chrome needs these).
# Bookworm (Debian 12) package names - note: NOT the -t64 names used on
# Ubuntu 24.04/Debian 13.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
    libasound2 fonts-liberation ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /tool

# npm ci needs the lockfile; push the manifest first to reuse the layer cache
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# chromium for puppeteer (downloads to /root/.cache, no sandbox needed at runtime)
ENV PUPPETEER_CACHE_DIR=/root/.cache/puppeteer

COPY build-pdf.js style.css ./

WORKDIR /work

ENTRYPOINT ["node", "/tool/build-pdf.js"]