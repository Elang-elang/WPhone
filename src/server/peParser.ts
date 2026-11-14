import crypto from 'node:crypto';

export interface PeInspectionResult {
  fileName: string;
  fileSizeBytes: number;
  sha256: string;
  validPe: boolean;
  formatLabel: string;
  arch: 'x86' | 'x64' | 'arm64' | 'unknown';
  machineHex: string;
  isDll: boolean;
  subsystem: string;
  sections: string[];
  importedDlls: string[];
  suggestedDependencies: string[];
  recommendedGraphics: string;
  notes: string;
}

function rvaToOffset(
  rva: number,
  sections: Array<{ virtualAddress: number; virtualSize: number; rawOffset: number; rawSize: number }>
): number | null {
  for (const sec of sections) {
    const span = Math.max(sec.virtualSize, sec.rawSize);
    if (rva >= sec.virtualAddress && rva < sec.virtualAddress + span) {
      return sec.rawOffset + (rva - sec.virtualAddress);
    }
  }
  return null;
}

function readCString(buf: Buffer, offset: number, maxLen = 128): string {
  if (offset < 0 || offset >= buf.length) return '';
  let end = offset;
  while (end < buf.length && end - offset < maxLen && buf[end] !== 0) {
    end++;
  }
  return buf.toString('ascii', offset, end);
}

export function inspectWindowsBinary(buffer: Buffer, fileName: string): PeInspectionResult {
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const fileSizeBytes = buffer.length;

  // Check MSI OLE2 compound document signature (D0 CF 11 E0 A1 B1 1A E1)
  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  ) {
    return {
      fileName,
      fileSizeBytes,
      sha256,
      validPe: false,
      formatLabel: 'Windows Installer Package (MSI / OLE2)',
      arch: 'x86',
      machineHex: 'OLE2-MSI',
      isDll: false,
      subsystem: 'msiexec.exe',
      sections: [],
      importedDlls: ['msi.dll'],
      suggestedDependencies: ['vcrun2022'],
      recommendedGraphics: 'wined3d-virgl',
      notes: 'MSI installer detected. WPhone executes MSI packages via `wine msiexec /i`.',
    };
  }

  // Check DOS MZ signature
  if (buffer.length < 0x40 || buffer[0] !== 0x4d || buffer[1] !== 0x5a) {
    return {
      fileName,
      fileSizeBytes,
      sha256,
      validPe: false,
      formatLabel: 'Unknown / Non-PE Binary',
      arch: 'unknown',
      machineHex: 'N/A',
      isDll: false,
      subsystem: 'Unknown',
      sections: [],
      importedDlls: [],
      suggestedDependencies: [],
      recommendedGraphics: 'wined3d-virgl',
      notes: 'Missing DOS MZ header. This file is not a standard Windows PE executable or MSI installer.',
    };
  }

  const peOffset = buffer.readUInt32LE(0x3c);
  if (
    peOffset + 24 >= buffer.length ||
    buffer[peOffset] !== 0x50 ||
    buffer[peOffset + 1] !== 0x45 ||
    buffer[peOffset + 2] !== 0x00 ||
    buffer[peOffset + 3] !== 0x00
  ) {
    return {
      fileName,
      fileSizeBytes,
      sha256,
      validPe: false,
      formatLabel: 'DOS MZ (No PE Header)',
      arch: 'unknown',
      machineHex: 'MZ-ONLY',
      isDll: false,
      subsystem: 'Legacy DOS',
      sections: [],
      importedDlls: [],
      suggestedDependencies: [],
      recommendedGraphics: 'wined3d-virgl',
      notes: 'DOS MZ executable without PE32/PE32+ header; requires DOSBox rather than Wine WoW64.',
    };
  }

  const coffStart = peOffset + 4;
  const machine = buffer.readUInt16LE(coffStart);
  const numberOfSections = buffer.readUInt16LE(coffStart + 2);
  const sizeOfOptionalHeader = buffer.readUInt16LE(coffStart + 16);
  const characteristics = buffer.readUInt16LE(coffStart + 18);
  const isDll = (characteristics & 0x2000) !== 0;

  let arch: PeInspectionResult['arch'] = 'unknown';
  if (machine === 0x014c) arch = 'x86';
  else if (machine === 0x8664) arch = 'x64';
  else if (machine === 0xaa64) arch = 'arm64';

  const optStart = coffStart + 20;
  const optMagic = optStart + 2 <= buffer.length ? buffer.readUInt16LE(optStart) : 0;
  const isPe32Plus = optMagic === 0x20b;

  let subsystemCode = 0;
  if (optStart + 70 <= buffer.length) {
    subsystemCode = buffer.readUInt16LE(optStart + 68);
  }
  const subsystem =
    subsystemCode === 2
      ? 'Windows GUI'
      : subsystemCode === 3
        ? 'Windows CUI (Console)'
        : `Subsystem #${subsystemCode}`;

  const sectionTableStart = optStart + sizeOfOptionalHeader;
  const sectionRecords: Array<{
    name: string;
    virtualAddress: number;
    virtualSize: number;
    rawOffset: number;
    rawSize: number;
  }> = [];

  for (let i = 0; i < numberOfSections; i++) {
    const off = sectionTableStart + i * 40;
    if (off + 40 > buffer.length) break;
    const rawName = buffer.toString('ascii', off, off + 8).replace(/\0+$/, '');
    const virtualSize = buffer.readUInt32LE(off + 8);
    const virtualAddress = buffer.readUInt32LE(off + 12);
    const rawSize = buffer.readUInt32LE(off + 16);
    const rawOffset = buffer.readUInt32LE(off + 20);
    sectionRecords.push({
      name: rawName,
      virtualAddress,
      virtualSize,
      rawOffset,
      rawSize,
    });
  }

  // Parse Import Directory Table (DataDirectory[1])
  const importedDllsSet = new Set<string>();
  const dataDirStart = isPe32Plus ? optStart + 112 : optStart + 96;
  const importDirEntryOff = dataDirStart + 8; // index 1
  if (importDirEntryOff + 8 <= buffer.length) {
    const importRva = buffer.readUInt32LE(importDirEntryOff);
    if (importRva > 0) {
      const importOffset = rvaToOffset(importRva, sectionRecords);
      if (importOffset !== null) {
        for (let idx = 0; idx < 256; idx++) {
          const entryOff = importOffset + idx * 20;
          if (entryOff + 20 > buffer.length) break;
          const nameRva = buffer.readUInt32LE(entryOff + 12);
          const firstThunk = buffer.readUInt32LE(entryOff + 16);
          if (nameRva === 0 && firstThunk === 0) break;
          const nameOffset = rvaToOffset(nameRva, sectionRecords);
          if (nameOffset !== null) {
            const dllName = readCString(buffer, nameOffset);
            if (dllName && /^[\w.-]+\.dll$/i.test(dllName)) {
              importedDllsSet.add(dllName);
            }
          }
        }
      }
    }
  }

  const importedDlls = Array.from(importedDllsSet);
  const lowerDlls = importedDlls.map((d) => d.toLowerCase());

  const suggestedDeps = new Set<string>();
  if (lowerDlls.some((d) => d.includes('vcruntime140') || d.includes('msvcp140'))) {
    suggestedDeps.add('vcrun2022');
  }
  if (lowerDlls.some((d) => d.includes('vcruntime120') || d.includes('msvcr120'))) {
    suggestedDeps.add('vcrun2013');
  }
  if (lowerDlls.some((d) => d.includes('d3dcompiler'))) {
    suggestedDeps.add('d3dcompiler_47');
  }
  if (lowerDlls.some((d) => d === 'mscoree.dll')) {
    suggestedDeps.add('dotnet48');
  }

  let recommendedGraphics = 'system-vulkan-dxvk';
  if (lowerDlls.some((d) => d === 'd3d12.dll')) {
    recommendedGraphics = 'vkd3d-proton';
  } else if (lowerDlls.some((d) => d === 'd3d11.dll' || d === 'd3d9.dll' || d === 'dxgi.dll')) {
    recommendedGraphics = 'turnip-dxvk';
  } else if (subsystem === 'Windows CUI (Console)' || importedDlls.length <= 4) {
    recommendedGraphics = 'wined3d-virgl';
  }

  const formatLabel = isPe32Plus
    ? `PE32+ (${arch.toUpperCase()} 64-bit)`
    : `PE32 (${arch.toUpperCase()} 32-bit)`;

  return {
    fileName,
    fileSizeBytes,
    sha256,
    validPe: true,
    formatLabel,
    arch,
    machineHex: `0x${machine.toString(16).padStart(4, '0')}`,
    isDll,
    subsystem,
    sections: sectionRecords.map((s) => s.name),
    importedDlls,
    suggestedDependencies: Array.from(suggestedDeps),
    recommendedGraphics,
    notes:
      arch === 'x64'
        ? 'Valid x64 PE executable. Executed via Box64 + Wine WoW64.'
        : arch === 'x86'
          ? 'Valid 32-bit x86 PE executable. Executed via Wine WoW64 thunking + Box64.'
          : 'PE binary parsed. Verify target architecture compatibility.',
  };
}
