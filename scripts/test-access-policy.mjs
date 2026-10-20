import assert from 'node:assert/strict';
import { isAllowedConversation } from '../src/access-policy.js';

const base = {
  allow: { groups: ['100'], private: ['200'] },
  deny: { groups: ['999'], private: ['888'] },
  allowAllWhenEmpty: false,
  allowJoinedGroups: true,
};
assert.equal(isAllowedConversation('group', 123, base), true, 'joined groups are allowed by default');
assert.equal(isAllowedConversation('group', 999, base), false, 'deny list overrides joined-group default');
assert.equal(isAllowedConversation('private', 123, base), false, 'joined-group default never opens private chats');
assert.equal(isAllowedConversation('private', 200, base), true, 'private allowlist still works');
assert.equal(isAllowedConversation('group', 123, { ...base, allowJoinedGroups: false }), false);
assert.equal(isAllowedConversation('group', 100, { ...base, allowJoinedGroups: false }), true);
console.log('PASS: joined groups default to allowed; deny overrides; private chats stay restricted');
