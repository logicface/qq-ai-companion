import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDiaryStore } from '../src/diary-store.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qq-diary-test-'));
let tick = 0;
const store = createDiaryStore({
  dir: tmp,
  maxEntriesPerDay: 3,
  maxContentChars: 120,
  now: () => new Date(Date.UTC(2026, 9, 20, 10, tick++))
});

try {
  const first = store.append({
    title: '  第一次\n写日记  ',
    mood: '开心',
    tags: ['群聊', '群聊', '  小事  '],
    content: '今天终于有自己的日记本了。'
  });
  assert.equal(first.day, '2026-10-20');
  assert.equal(first.title, '第一次 写日记');
  assert.deepEqual(first.tags, ['群聊', '小事']);
  assert.ok(fs.existsSync(path.join(tmp, 'diary.jsonl')));
  assert.match(fs.readFileSync(path.join(tmp, '2026-10-20.md'), 'utf8'), /今天终于有自己的日记本了/);

  store.append({ content: '第二条。' });
  store.append({ content: '第三条。' });
  assert.throws(() => store.append({ content: '第四条。' }), /写满 3 条/);
  assert.deepEqual(store.recent(2).map((entry) => entry.content), ['第三条。', '第二条。']);

  fs.appendFileSync(store.indexFile, '{broken json}\n', 'utf8');
  assert.equal(store.recent(20).length, 3, '损坏单行应被跳过');
  assert.throws(() => store.append({ content: '' }), /不能为空/);
  assert.throws(() => store.append({ content: '长'.repeat(121) }), /不能超过 120 字/);
  console.log('diary store: 12/12 passed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

