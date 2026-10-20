import fs from 'node:fs';
import path from 'node:path';
import { isAboutBot } from './bot-reference.js';

export function sponsorshipCommand(event, kind, recent = []) {
  if (!Array.isArray(event?.message)) return null;
  if (event.message.some(segment => segment?.type === 'at'
    && String(segment.data?.qq) !== String(event.self_id))) return null;
  const content = event.message.filter(segment => segment?.type === 'text')
    .map(segment => String(segment.data?.text ?? '')).join('').trim();
  const match = content.match(/^\/?(?:赞助|打赏|收款码|乞讨)(?:\s+(微信|支付宝))?$/u);
  if (match) return match[1] || 'both';
  const directed = kind === 'private' || event.message.some(segment =>
    segment?.type === 'at' && String(segment.data?.qq) === String(event.self_id))
    || isAboutBot(content, recent);
  if (!directed || /(?:不要|别再|别|不想|不准|不用|不许|拒绝).{0,8}(?:投喂|打赏|赞助|收款码|给你钱|赏钱)/u.test(content)) return null;
  // The user is asking the bot for money: playfully turn the bowl around.
  if (/(?:赏(?:我|点|口|我点)?(?:钱|饭)|给我(?:点|发点)?钱|发我(?:点|个)?红包)/u.test(content)) return 'reverse';
  // Require a request about this bot, rather than any discussion containing “钱”.
  if (/(?:赏你.{0,6}(?:钱|红包)|给你.{0,8}(?:钱|红包)|请你喝(?:奶茶|咖啡)|(?:给你|向你)(?:投喂|打赏|赞助)|(?:投喂|打赏|赞助)你|(?:你的|给个|发个|亮个|亮出|看看|来个|有没有).{0,3}收款码|(?:怎么|如何).{0,6}(?:打赏|投喂|赞助)(?:你|他|它)?[呀啊呢吗嘛！!？?。～~\s]*$)/u.test(content)
    || /^(?:想|我想|要|我来|可以)?(?:打赏|投喂|赞助)(?:一下|一点|点|一口|你)?[呀啊吧呗吗嘛呢！!？?。～~\s]*$/u.test(content)) return 'both';
  return null;
}

export function createSponsorshipResponder({ assetDirectory, send, now = Date.now, cooldownMs = 60000,
  stateFile, allowed = () => true, getRecent = () => [], reminderIntervalMs = 6 * 60 * 60 * 1000 }) {
  const lastSent = new Map();
  const activity = new Map();
  let reminders = {};
  if (stateFile && fs.existsSync(stateFile)) reminders = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  const persist = () => {
    if (!stateFile) return;
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile + '.tmp', JSON.stringify(reminders));
    fs.renameSync(stateFile + '.tmp', stateFile);
  };
  const imageFiles = (platform) => platform === '微信' ? ['wechat-compact.png']
    : platform === '支付宝' ? ['alipay-compact.png'] : ['compact.png'];
  const hasAssets = (platform) => imageFiles(platform)
    .every(file => fs.existsSync(path.join(assetDirectory, file)));
  const deliver = async (kind, id, platform, proactive = false) => {
    const images = imageFiles(platform);
    const text = platform === 'reverse'
      ? '你找我要钱？巧了，我也端着碗🥣 来都来了，不如反向投喂一口赛博鱼粮？全凭自愿，不投也陪你唠。钱归饲养员，我负责摇尾巴，扫码认准收款人嗷～'
      : proactive
      ? '路过的老板看一眼，电子乞丐来巡演🥣 小鲸鱼把碗往前挪了两厘米，主打一个自愿投喂。赏口赛博鱼粮？不赏也行，我端着碗陪你们唠。扫码是给饲养员转账，认准收款人嗷～'
      : '老板行行好，赏口赛博鱼粮吧🥣 小鲸鱼会聊天、会接梗，还会熟练地把碗递到您跟前。微信支付宝，哪个顺手扫哪个；全凭自愿，不投也照样陪你唠！钱进饲养员口袋，我负责摇尾巴，扫码认准收款人嗷～';
    await send(kind, id, [{ type: 'text', data: { text } }, ...images.map(file => ({
      type: 'image', data: { file: `base64://${fs.readFileSync(path.join(assetDirectory, file)).toString('base64')}` },
    }))]);
    if (kind === 'group') { reminders[String(id)] = now(); persist(); }
  };
  const respond = async (kind, id, event) => {
    const platform = sponsorshipCommand(event, kind, getRecent(kind, id));
    if (!platform || !allowed(kind, id) || !hasAssets(platform)) return false;
    const key = `${kind}:${id}`;
    const time = now();
    if (lastSent.has(key) && time - lastSent.get(key) < cooldownMs) return true;
    // Reserve before awaiting the upload so simultaneous requests cannot flood the chat.
    lastSent.set(key, time);
    try { await deliver(kind, id, platform); }
    catch (error) { lastSent.delete(key); throw error; }
    return true;
  };
  respond.noteActivity = (kind, id) => {
    if (kind !== 'group' || !allowed(kind, id)) return;
    const key = String(id);
    const item = activity.get(key) || { first: now(), count: 0 };
    item.last = now(); item.count++;
    activity.set(key, item);
  };
  let ticking = false;
  respond.tick = async () => {
    if (ticking) return;
    ticking = true;
    try {
      for (const [id, item] of activity) {
        const time = now();
        if (!hasAssets('both') || !allowed('group', id) || item.count < 10 || time - item.first < 600000
          || time - item.last > 1800000
          || (reminders[id] != null && time - reminders[id] < reminderIntervalMs)) continue;
        await deliver('group', id, 'both', true);
        item.count = 0;
      }
    } finally { ticking = false; }
  };
  return respond;
}
