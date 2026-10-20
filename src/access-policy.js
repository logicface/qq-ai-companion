export function isAllowedConversation(kind, id, cfg = {}) {
  const normalizedKind = kind === 'group' ? 'group' : 'private';
  const s = String(id);
  const denyList = cfg.deny?.[normalizedKind] ?? cfg.deny?.[normalizedKind + 's'] ?? [];
  if (denyList.map(String).includes(s)) return false;
  if (normalizedKind === 'group' && cfg.allowJoinedGroups === true) return true;
  const allowList = cfg.allow?.[normalizedKind] ?? cfg.allow?.[normalizedKind + 's'] ?? [];
  if (allowList.length > 0) return allowList.map(String).includes(s);
  return cfg.allowAllWhenEmpty === true;
}
