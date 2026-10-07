/**
 * Minimal ZIP archive builder — "store" mode only (no compression).
 *
 * The coffre-fort only ever archives PDFs and images, which are already
 * compressed; deflating them again buys nothing, so a store-only writer keeps
 * the whole feature dependency-free rather than pulling in archiver/jszip.
 * Produces a standard .zip readable by Windows Explorer, macOS and 7-Zip.
 */

type Entry = { name: string; data: Buffer; crc: number; offset: number };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Builds a ZIP from a list of in-memory files. */
export function buildZip(files: { name: string; data: Buffer }[]): Buffer {
  const chunks: Buffer[] = [];
  const entries: Entry[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const crc = crc32(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8 filename
    local.writeUInt16LE(0, 8); // method: store
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18); // compressed size
    local.writeUInt32LE(file.data.length, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra length

    entries.push({ name: file.name, data: file.data, crc, offset });
    chunks.push(local, nameBuf, file.data);
    offset += local.length + nameBuf.length + file.data.length;
  }

  const central: Buffer[] = [];
  let centralSize = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf8");
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0); // central dir signature
    header.writeUInt16LE(20, 4); // version made by
    header.writeUInt16LE(20, 6); // version needed
    header.writeUInt16LE(0x0800, 8); // flags: UTF-8
    header.writeUInt16LE(0, 10); // method: store
    header.writeUInt16LE(0, 12); // mod time
    header.writeUInt16LE(0, 14); // mod date
    header.writeUInt32LE(e.crc, 16);
    header.writeUInt32LE(e.data.length, 20);
    header.writeUInt32LE(e.data.length, 24);
    header.writeUInt16LE(nameBuf.length, 28);
    header.writeUInt16LE(0, 30); // extra length
    header.writeUInt16LE(0, 32); // comment length
    header.writeUInt16LE(0, 34); // disk number
    header.writeUInt16LE(0, 36); // internal attrs
    header.writeUInt32LE(0, 38); // external attrs
    header.writeUInt32LE(e.offset, 42); // local header offset
    central.push(header, nameBuf);
    centralSize += header.length + nameBuf.length;
  }

  const centralOffset = offset;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central dir signature
  end.writeUInt16LE(0, 4); // disk number
  end.writeUInt16LE(0, 6); // central dir start disk
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...chunks, ...central, end]);
}
