#!/usr/bin/env node

/**
 * Sync package.json/package-lock.json version with pyproject.toml.
 * This keeps the frontend metadata aligned to the backend single source of truth.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const pyprojectPath = path.join(repoRoot, 'pyproject.toml');
const packageJsonPath = path.join(repoRoot, 'frontend', 'package.json');
const packageLockPath = path.join(repoRoot, 'frontend', 'package-lock.json');

const pyprojectRaw = fs.readFileSync(pyprojectPath, 'utf8');
const versionMatch = pyprojectRaw.match(/^\s*version\s*=\s*"([^"]+)"/m);

if (!versionMatch) {
  console.error('Could not find version in pyproject.toml');
  process.exit(1);
}

const version = versionMatch[1];

const updateJsonFile = (filePath) => {
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (json.version === version) {
    return false;
  }
  json.version = version;
  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`);
  return true;
};

const updatedPkg = updateJsonFile(packageJsonPath);
const updatedLock = updateJsonFile(packageLockPath);

if (updatedPkg || updatedLock) {
  console.log(`Synced frontend package version to ${version}`);
} else {
  console.log('Frontend package version already in sync');
}
