#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.resolve(__dirname, '..', 'src', 'chinese_words.json');
const CEDICT_URL = 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz';

const gunzip = promisify(zlib.gunzip);

// Words/phrases in English definition that indicate an entry should be skipped
const SKIP_WORDS = [
  'surname', 'variant of', 'also written', 'also pr', 'also called',
  'see ', 'CL:', 'classifier:', 'old name', 'former name',
  'place name', 'county', 'province', 'prefecture', 'mountain', 'river',
  'district', 'kingdom', 'dynasty', 'emperor', 'empire', 'archipelago',
  'peninsula', 'gulf', 'strait', 'banner', 'league', 'town', 'village',
  'city in', 'town in', 'area in', 'region in', 'part of', 'saint', 'holiday',
  'chemistry', 'physics', 'biology', 'geology', 'medicine', 'surgery',
  'diagnosis', 'syndrome', 'alloy', 'chromosome', 'catalyst', 'enzyme',
  'metabolism', 'bacterium', 'bacteria', 'virus', 'fungus', 'organism',
  'political', 'communist', 'party', 'chairman', 'president', 'secretary',
  'sex', 'sexual', 'prostitute', 'prostitution', 'whore', 'slut', 'bitch',
  'fuck', 'shit', 'damn', 'bastard', 'asshole', 'penis', 'vagina',
  'genital', 'intercourse', 'masturbate', 'masturbation', 'porn',
  'pornography', 'orgasm', 'ejaculate', 'ejaculation', 'erectile',
  'condom', 'contraceptive', 'abortion', 'abort', 'neologism',
  'abbreviation',
];

function toToneMarks(s) {
  s = s.toLowerCase();
  const replacements = [
    ['a1','ā'],['a2','á'],['a3','ǎ'],['a4','à'],
    ['e1','ē'],['e2','é'],['e3','ě'],['e4','è'],
    ['i1','ī'],['i2','í'],['i3','ǐ'],['i4','ì'],
    ['o1','ō'],['o2','ó'],['o3','ǒ'],['o4','ò'],
    ['u1','ū'],['u2','ú'],['u3','ǔ'],['u4','ù'],
    ['ü1','ǖ'],['ü2','ǘ'],['ü3','ǚ'],['ü4','ǜ'],
    ['v1','ǖ'],['v2','ǘ'],['v3','ǚ'],['v4','ǜ'],
    ['u:','ü'],
  ];
  for (const [old, nu] of replacements) s = s.replaceAll(old, nu);
  s = s.replace(/[1-5]/g, '');
  return s;
}

function shouldSkip(english) {
  const lower = english.toLowerCase();
  for (const word of SKIP_WORDS) {
    if (lower.includes(word)) return true;
  }
  // Skip if English starts with a capital letter (proper noun)
  if (/^[A-Z]/.test(english.trim())) return true;
  // Skip single-word English definitions that are capitalized (names)
  if (/^[A-Z][a-z]+$/.test(english.trim())) return true;
  // Skip entries with numbers in English
  if (/\d/.test(english)) return true;
  return false;
}

async function main() {
  console.log('Downloading CC-CEDICT...');
  const res = await fetch(CEDICT_URL);
  const buf = await res.arrayBuffer();
  console.log('Decompressing...');
  const txt = (await gunzip(Buffer.from(buf))).toString('utf-8');
  console.log('Parsing...');

  const entries = [];
  const seen = new Set();
  const LINE_RE = /^[^ ]+ ([^ ]+) \[([^\]]+)\] \/([^/]+)/;

  for (const line of txt.split('\n')) {
    if (line[0] === '#' || !line.trim()) continue;
    const m = line.match(LINE_RE);
    if (!m) continue;
    const [_, simplified, pinyinRaw, english] = m;

    if (simplified.length < 2 || simplified.length > 4) continue;
    if (seen.has(simplified)) continue;
    if (/[a-zA-Z0-9]/.test(simplified)) continue;
    if (shouldSkip(english.trim())) continue;

    const pinyin = toToneMarks(pinyinRaw);
    seen.add(simplified);
    entries.push([simplified, pinyin, english.trim()]);
  }

  console.log('Total before quality filter: ' + entries.length);

  // Quality filter: prefer entries with short English definitions (1-2 words)
  // and avoid entries with parenthetical notes
  const clean = entries.filter(([_, __, english]) => {
    const trimmed = english.trim();
    // No parentheses
    if (trimmed.includes('(') || trimmed.includes(')')) return false;
    // No semicolons or multiple definitions
    if (trimmed.includes(';') || trimmed.includes('|')) return false;
    // Max 4 words
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount > 4) return false;
    return true;
  });

  console.log('After quality filter: ' + clean.length);

  // Cap at 5000 entries for a good game vocabulary
  const final = clean.slice(0, 5000);

  final.sort((a, b) => a[0].localeCompare(b[0], 'zh'));
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(final, null, 2), 'utf-8');
  console.log('Written ' + final.length + ' words to ' + OUTPUT_PATH);
}

main().catch(e => { console.error(e); process.exit(1); });
