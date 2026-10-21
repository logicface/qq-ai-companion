import assert from 'node:assert/strict';
import { classifyBalanceCommand, formatDeepSeekBalance, getDeepSeekBalance } from '../src/deepseek-balance.js';

assert.equal(classifyBalanceCommand('查询余额', { isOwner: true, kind: 'private' }), 'allowed');
assert.equal(classifyBalanceCommand('/balance', { isOwner: true, kind: 'group' }), 'private-only');
assert.equal(classifyBalanceCommand('API余额', { isOwner: false, kind: 'private' }), 'denied');
assert.equal(classifyBalanceCommand('还有多少余额', { isOwner: true, kind: 'private' }), 'none');

let request = null;
const result = await getDeepSeekBalance({
  credential: 'fixture-key',
  fetchImpl: async (url, init) => {
    request = { url, init };
    return Response.json({
      is_available: true,
      balance_infos: [{
        currency: 'CNY',
        total_balance: '6.95',
        topped_up_balance: '6.95',
        granted_balance: '0.00'
      }]
    });
  }
});

assert.equal(request.url, 'https://api.deepseek.com/user/balance');
assert.equal(request.init.headers.authorization, 'Bearer fixture-key');
assert.equal(result.is_available, true);
assert.equal(
  formatDeepSeekBalance(result),
  'DeepSeek API 余额：可用\nCNY：总额 ¥6.95（充值 ¥6.95，赠金 ¥0.00）'
);

await assert.rejects(() => getDeepSeekBalance({ credential: '' }), /API Key 未配置/);
await assert.rejects(
  () => getDeepSeekBalance({
    credential: 'fixture-key',
    fetchImpl: async () => new Response('', { status: 401 })
  }),
  /HTTP 401/
);

console.log('PASS DeepSeek 余额查询、格式化与管理员私聊权限分类');
