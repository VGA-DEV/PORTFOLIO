// Packs the static export (out/) into deploy/vga-dev-site.zip, ready to upload from the hosting panel.
// Written by hand (no dependency): a zip is a few headers around deflated files, and building it here keeps
// the entry names with forward slashes, which the Windows archive tools get wrong for a Linux server.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const root = 'out';
const target = 'deploy/vga-dev-site.zip';

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(path);
  }
};

try {
  walk(root);
} catch {
  console.error('There is no out/ folder: run `npm run build` first.');
  process.exit(1);
}
if (!files.some((file) => file.endsWith('.htaccess'))) {
  console.error('out/.htaccess is missing: public/.htaccess was not copied by the build.');
  process.exit(1);
}

// Fixed timestamp (2026-01-01), so the same site always gives the same bytes.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

const parts = [];
const central = [];
let offset = 0;

for (const file of files) {
  const name = Buffer.from(relative(root, file).split(sep).join('/'));
  const data = readFileSync(file);
  const packed = deflateRawSync(data, { level: 9 });
  const stored = packed.length >= data.length;
  const body = stored ? data : packed;
  const method = stored ? 0 : 8;
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // names are UTF-8
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  parts.push(local, name, body);

  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0x0800, 8);
  entry.writeUInt16LE(method, 10);
  entry.writeUInt16LE(DOS_TIME, 12);
  entry.writeUInt16LE(DOS_DATE, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(body.length, 20);
  entry.writeUInt32LE(data.length, 24);
  entry.writeUInt16LE(name.length, 28);
  entry.writeUInt32LE(offset, 42);
  central.push(entry, name);

  offset += local.length + name.length + body.length;
}

const directory = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);

mkdirSync('deploy', { recursive: true });
const zip = Buffer.concat([...parts, directory, end]);
writeFileSync(target, zip);
console.log(`${target}: ${files.length} files, ${(zip.length / 1024).toFixed(0)} KB`);
