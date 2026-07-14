#!/bin/sh
set -eu

APP_DIR="${AURORA_APP_DIR:-/opt/aurora/aurora}"
BRANCH="${AURORA_BRANCH:-master}"

cd "$APP_DIR"

git fetch origin "$BRANCH"

LOCAL_COMMIT="$(git rev-parse HEAD)"
REMOTE_COMMIT="$(git rev-parse "origin/$BRANCH")"

if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
    exit 0
fi

git reset --hard "origin/$BRANCH"
docker compose up -d --build
docker compose ps
