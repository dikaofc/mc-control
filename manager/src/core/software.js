// Software catalog + jar downloader.
// Sources use official / well-known public APIs. Bedrock uses Mojang's CDN.
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGetJson(res.headers.location).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('Bad JSON from ' + url)); }
      });
    }).on('error', reject);
  });
}

function httpDownload(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        fs.unlink(dest, () => {});
        return httpDownload(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        fs.unlink(dest, () => {});
        return reject(new Error('Download failed (' + res.statusCode + '): ' + url));
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
    }).on('error', (e) => { fs.unlink(dest, () => {}); reject(e); });
  });
}

// ---- Vanilla -------------------------------------------------------------
export async function vanillaVersions() {
  const manifest = await httpGetJson('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json');
  return manifest.versions.map((v) => ({
    version: v.id, type: v.type, released: v.releaseTime, serverUrl: null,
  }));
}

async function vanillaServerUrl(versionId) {
  const manifest = await httpGetJson('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json');
  const ver = manifest.versions.find((v) => v.id === versionId);
  if (!ver) return null;
  const meta = await httpGetJson(ver.url);
  const server = meta.downloads && meta.downloads.server;
  return server ? server.url : null;
}

// ---- Paper ---------------------------------------------------------------
// PaperMC retired the v2 downloads API. Resolution now tries (in order):
//  1. new PaperMC downloads service (downloads.papermc.io)
//  2. GitHub releases assets (PaperMC/paper) tagged by version
// Each step degrades gracefully if the host is unreachable.
export async function paperVersions() {
  // Best-effort version list. If the host is blocked we return an empty list
  // and the UI falls back to a manual version field.
  try {
    const data = await httpGetJson('https://downloads.papermc.io/v2/projects/paper');
    if (data && data.versions) return data.versions.map((v) => ({ version: v }));
  } catch {}
  try {
    const data = await httpGetJson('https://api.purpurmc.org/v2/purpur');
    // Purpur is 1:1 with Paper MC versions — reuse as a version suggestion list.
    if (data && data.versions) return data.versions.map((v) => ({ version: v }));
  } catch {}
  return [];
}
async function paperBuild(version) {
  // Try new downloads service first.
  try {
    const builds = await httpGetJson(`https://downloads.papermc.io/v2/projects/paper/versions/${version}/builds`);
    const list = (builds.builds || builds.all || []);
    if (list.length) {
      const latest = list[list.length - 1];
      const name = latest.downloads?.application?.name || latest.downloads?.name;
      if (name) return `https://downloads.papermc.io/v2/projects/paper/versions/${version}/builds/${latest.build}/downloads/${name}`;
    }
  } catch {}
  // Fallback: GitHub release asset. Paper tags releases like "1.21.4".
  try {
    const rel = await httpGetJson(`https://api.github.com/repos/PaperMC/paper/releases/tags/${version}`);
    const asset = (rel.assets || []).find((a) => /paper-.*\.jar$/.test(a.name));
    if (asset) return asset.browser_download_url;
  } catch {}
  return null;
}

// ---- Purpur --------------------------------------------------------------
export async function purpurVersions() {
  const data = await httpGetJson('https://api.purpurmc.org/v2/purpur');
  return (data.versions || []).map((v) => ({ version: v }));
}
async function purpurBuild(version) {
  const data = await httpGetJson(`https://api.purpurmc.org/v2/purpur/${version}`);
  const builds = data.builds || {};
  const all = builds.all || [];
  if (!all.length) return null;
  const latest = all[all.length - 1];
  return `https://api.purpurmc.org/v2/purpur/${version}/${latest}/download`;
}

// ---- Fabric --------------------------------------------------------------
export async function fabricVersions() {
  const data = await httpGetJson('https://meta.fabricmc.net/v2/versions/game');
  return data.filter((v) => v.stable).map((v) => ({ version: v.version }));
}
async function fabricBuild(version) {
  // Fabric server launcher jar (fabric-installer) + mapped mc version.
  const installer = await httpGetJson('https://meta.fabricmc.net/v2/versions/installer');
  const loader = await httpGetJson('https://meta.fabricmc.net/v2/versions/loader');
  const inst = installer[0] && installer[0].version;
  const load = loader[0] && loader[0].version;
  if (!inst || !load) return null;
  // Fabric runs via installer; we fetch the installer jar and the dashboard
  // instructs running it once to produce the server jar.
  return {
    installerUrl: `https://meta.fabricmc.net/v2/versions/installer/${inst}/downloads/fabric-installer-${inst}.jar`,
    loader, version,
  };
}

// ---- Forge ---------------------------------------------------------------
export async function forgeVersions() {
  const data = await httpGetJson('https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json');
  const out = [];
  for (const [mc, info] of Object.entries(data)) {
    const versions = info.versions || info || [];
    if (Array.isArray(versions)) versions.forEach((v) => out.push({ version: `${mc}-${v}` }));
  }
  return out;
}
async function forgeBuild(spec) {
  // spec like "1.21.1-52.0.0" -> maven path net.minecraftforge:forge
  const [mc, build] = spec.split('-');
  if (!mc || !build) return null;
  return `https://maven.minecraftforge.net/net/minecraftforge/forge/${mc}-${build}/forge-${mc}-${build}-installer.jar`;
}

// ---- Bedrock -------------------------------------------------------------
// Bedrock dedicated server is distributed by Mojang via azureedge CDN.
// Version list is kept in a small local manifest; update as needed.
const BEDROCK_VERSIONS = [
  { version: '1.21.50.04', url: 'https://minecraft.azureedge.net/bin-linux/bedrock-server-1.21.50.04.zip' },
  { version: '1.21.44.01', url: 'https://minecraft.azureedge.net/bin-linux/bedrock-server-1.21.44.01.zip' },
  { version: '1.21.40.21', url: 'https://minecraft.azureedge.net/bin-linux/bedrock-server-1.21.40.21.zip' },
];
export function bedrockVersions() { return BEDROCK_VERSIONS.slice(); }

// ---- Public catalog ------------------------------------------------------
const SOFTWARES = [
  { id: 'vanilla', label: 'Vanilla', platform: 'java', needsVersion: true },
  { id: 'paper', label: 'Paper', platform: 'java', needsVersion: true },
  { id: 'purpur', label: 'Purpur', platform: 'java', needsVersion: true },
  { id: 'fabric', label: 'Fabric', platform: 'java', needsVersion: true },
  { id: 'forge', label: 'Forge', platform: 'java', needsVersion: true },
  { id: 'spigot', label: 'Spigot (BuildTools)', platform: 'java', needsVersion: true, manual: true },
  { id: 'bedrock', label: 'Bedrock Dedicated', platform: 'bedrock', needsVersion: true },
];

export function softwareCatalog() { return SOFTWARES.slice(); }

export async function listVersions(software) {
  switch (software) {
    case 'vanilla': return vanillaVersions();
    case 'paper': return paperVersions();
    case 'purpur': return purpurVersions();
    case 'fabric': return fabricVersions();
    case 'forge': return forgeVersions();
    case 'bedrock': return bedrockVersions();
    default: return [];
  }
}

// Resolve a download URL for a given software+version. Bedrock returns zip URL.
export async function resolveDownload(software, version) {
  switch (software) {
    case 'vanilla': return { url: await vanillaServerUrl(version), kind: 'jar' };
    case 'paper': return { url: await paperBuild(version), kind: 'jar' };
    case 'purpur': return { url: await purpurBuild(version), kind: 'jar' };
    case 'fabric': return { url: null, kind: 'fabric', meta: await fabricBuild(version) };
    case 'forge': return { url: await forgeBuild(version), kind: 'forge' };
    case 'bedrock': {
      const b = BEDROCK_VERSIONS.find((x) => x.version === version);
      return { url: b ? b.url : null, kind: 'zip' };
    }
    default: return { url: null, kind: 'jar' };
  }
}

// Install software into a server dir. Returns { jarFile } for java, { binary } for bedrock.
export async function installSoftware(software, version, serverDir) {
  const resolved = await resolveDownload(software, version);
  const { url, kind, meta } = resolved;
  if (kind === 'zip') {
    if (!url) throw new Error(`No download available for bedrock ${version}`);
    const zipPath = path.join(config.cacheDir, `bedrock-${version}.zip`);
    await httpDownload(url, zipPath);
    const { execFileSync } = await import('node:child_process');
    try {
      execFileSync('unzip', ['-o', zipPath, '-d', serverDir], { stdio: 'ignore' });
    } catch {
      try { execFileSync('python3', ['-c', `import zipfile;zipfile.ZipFile('${zipPath}').extractall('${serverDir}')`], { stdio: 'ignore' }); }
      catch { throw new Error('No unzip or python3 available to extract bedrock server'); }
    }
    return { kind: 'bedrock', binary: 'bedrock_server' };
  }
  if (kind === 'fabric') {
    if (!meta || !meta.installerUrl) throw new Error(`No Fabric installer for ${version}`);
    // Download installer; the server jar is produced at first launch via a wrapper.
    const instPath = path.join(serverDir, 'fabric-installer.jar');
    await httpDownload(meta.installerUrl, instPath);
    // Pre-generate server jar so the manager can run it directly.
    const { execFileSync } = await import('node:child_process');
    try {
      execFileSync(config.javaBin, ['-jar', 'fabric-installer.jar', 'server', '-mcversion', version, '-loader', meta.loader, '-downloadMinecraft'], { cwd: serverDir, stdio: 'ignore' });
    } catch (e) {
      throw new Error('Fabric installer failed: ' + e.message);
    }
    return { kind: 'jar', jarFile: 'fabric-server-launch.jar' };
  }
  if (kind === 'forge') {
    if (!url) throw new Error(`No download available for forge ${version}`);
    const instPath = path.join(serverDir, 'forge-installer.jar');
    await httpDownload(url, instPath);
    const { execFileSync } = await import('node:child_process');
    try {
      execFileSync(config.javaBin, ['-jar', 'forge-installer.jar', '--installServer'], { cwd: serverDir, stdio: 'ignore' });
    } catch (e) {
      throw new Error('Forge installer failed: ' + e.message);
    }
    // Forge produces a renamed forge jar; find it.
    const fs = await import('node:fs');
    const jar = fs.readdirSync(serverDir).find((f) => /^forge-.*\.jar$/.test(f) && !f.includes('installer'));
    return { kind: 'jar', jarFile: jar || 'server.jar' };
  }
  // vanilla / paper / purpur : plain jar
  if (!url) throw new Error(`No download available for ${software} ${version}`);
  const jarName = 'server.jar';
  const jarPath = path.join(serverDir, jarName);
  await httpDownload(url, jarPath);
  return { kind: 'jar', jarFile: jarName };
}
