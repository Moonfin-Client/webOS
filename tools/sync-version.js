#!/usr/bin/env node

import fs from 'fs';

const packageInfo = JSON.parse(fs.readFileSync('package.json'));
const appInfo = JSON.parse(fs.readFileSync('frontend/appinfo.json'));
const servicesPackageInfo = JSON.parse(fs.readFileSync('services/package.json'));

fs.writeFileSync(
  'frontend/appinfo.json',
  `${JSON.stringify(
    {
      ...appInfo,
      version: packageInfo.version,
    },
    null,
    4,
  )}\n`,
);

fs.writeFileSync(
  'services/package.json',
  `${JSON.stringify(
    {
      ...servicesPackageInfo,
      version: packageInfo.version,
    },
    null,
    2,
  )}\n`,
);