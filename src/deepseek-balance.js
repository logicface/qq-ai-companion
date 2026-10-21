const BALANCE_URL = 'https://api.deepseek.com/user/balance';
const BALANCE_COMMAND_RE = /^(?:\/balance|查询余额|余额查询|deepseek\s*余额|api\s*余额)$/i;

export function classifyBalanceCommand(text, { isOwner = false, kind = '' } = {}) {
  if (!BALANCE_COMMAND_RE.test(String(text ?? '').trim())) return 'none';
  if (!isOwner) return 'denied';
  if (kind !== 'private') return 'private-only';
  return 'allowed';
}

export async function getDeepSeekBalance({
  credential = process.env.DEEPSEEK_API_KEY,
  fetchImpl = globalThis.fetch,
  timeoutMs = 15_000
} = {}) {
  const key = String(credential ?? '').trim();
  if (!key) throw new Error('DeepSeek API Key 未配置');
  if (typeof fetchImpl !== 'function') throw new Error('当前运行环境不支持 fetch');

  const response = await fetchImpl(BALANCE_URL, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${key}`
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`DeepSeek 余额接口返回 HTTP ${response.status}`);

  const data = await response.json();
  if (!data || typeof data.is_available !== 'boolean' || !Array.isArray(data.balance_infos)) {
    throw new Error('DeepSeek 余额接口返回格式异常');
  }
  return data;
}

export function formatDeepSeekBalance(data) {
  const lines = [`DeepSeek API 余额：${data?.is_available ? '可用' : '不可用'}`];
  const infos = Array.isArray(data?.balance_infos) ? data.balance_infos : [];
  for (const info of infos) {
    const currency = String(info?.currency ?? '').toUpperCase();
    const unit = currency === 'CNY' ? '¥' : (currency === 'USD' ? '$' : `${currency} `);
    lines.push(`${currency || '余额'}：总额 ${unit}${info?.total_balance ?? '未知'}（充值 ${unit}${info?.topped_up_balance ?? '未知'}，赠金 ${unit}${info?.granted_balance ?? '未知'}）`);
  }
  return lines.join('\n');
}
