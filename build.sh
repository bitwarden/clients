#!/usr/bin/env bash

cd apps/desktop/desktop_native/napi
npm run build
cd ../..
npm run build && npm run pack:win
cd ../..

