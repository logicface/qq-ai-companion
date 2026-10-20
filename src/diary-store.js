import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const pad2 = (value) => String(value).padStart(2, '0');

function dayOf(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function timeOf(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function cleanSingleLine(value, maxChars) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, maxChars);
}

function cleanTags(value) {
  if (!Array.isArray(value)) return [];
  const tags = value.map((item) => cleanSingleLine(item, 24)).filter(Boolean);
  return [...new Set(tags)].slice(0, 8);
}

export function createDiaryStore({ dir, maxEntriesPerDay = 3, maxContentChars = 1000, now = () => new Date() } = {}) {
  if (!dir) throw new Error('日记目录不能为空');
  const root = path.resolve(dir);
  const indexFile = path.join(root, 'diary.jsonl');
  const dailyLimit = Math.max(1, Math.min(20, Number(maxEntriesPerDay) || 3));
  const contentLimit = Math.max(100, Math.min(5000, Number(maxContentChars) || 1000));

  function readAll() {
    let raw = '';
    try { raw = fs.readFileSync(indexFile, 'utf8'); } catch (error) {
      if (error?.code === 'ENOENT') return [];
      throw error;
    }
    const entries = [];
    for (const line of raw.split(/\r?\n/)) {
      const value = line.trim();
      if (!value) continue;
      try {
        const row = JSON.parse(value);
        if (row && typeof row === 'object' && typeof row.content === 'string') entries.push(row);
      } catch {
        // 追加文件里单独一行损坏时跳过，不能让整本日记不可读。
      }
    }
    return entries;
  }

  function append(input = {}) {
    const content = String(input.content ?? '').trim();
    if (!content) throw new Error('日记正文不能为空');
    if (content.length > contentLimit) throw new Error(`日记正文不能超过 ${contentLimit} 字`);

    const stamp = now();
    if (!(stamp instanceof Date) || Number.isNaN(stamp.getTime())) throw new Error('日记时间无效');
    const day = dayOf(stamp);
    const entries = readAll();
    const countToday = entries.filter((entry) => entry.day === day).length;
    if (countToday >= dailyLimit) throw new Error(`今天已经写满 ${dailyLimit} 条日记了，明天再写`);

    const row = {
      id: crypto.randomUUID(),
      timestamp: stamp.toISOString(),
      day,
      time: timeOf(stamp),
      title: cleanSingleLine(input.title, 60),
      mood: cleanSingleLine(input.mood, 24),
      tags: cleanTags(input.tags),
      content
    };

    fs.mkdirSync(root, { recursive: true });
    fs.appendFileSync(indexFile, `${JSON.stringify(row)}\n`, 'utf8');

    const dailyFile = path.join(root, `${day}.md`);
    const heading = fs.existsSync(dailyFile) ? '' : `# ${day}\n`;
    const title = row.title ? `**${row.title}**\n\n` : '';
    const mood = row.mood ? ` · ${row.mood}` : '';
    const tags = row.tags.length ? `\n\n${row.tags.map((tag) => `\`${tag.replace(/`/g, '')}\``).join(' ')}` : '';
    fs.appendFileSync(dailyFile, `${heading}\n## ${row.time}${mood}\n\n${title}${row.content}${tags}\n`, 'utf8');
    return row;
  }

  function recent(limit = 5) {
    const safeLimit = Math.max(1, Math.min(20, Number(limit) || 5));
    return readAll().slice(-safeLimit).reverse();
  }

  return { append, recent, indexFile, dir: root };
}

