// A wake is an opportunity for the agent to judge the context, not an instruction
// to answer every ambiguous pronoun.
export function isAboutBot(text, recent = [], { aliases = [], now = Date.now() } = {}) {
  const mentions = value => {
    const lower = String(value || '').toLowerCase();
    return aliases.some(alias => String(alias).trim() && lower.includes(String(alias).toLowerCase()))
      || /(?:这个|那个|这只|那只|你家|群里[的这只个]*)?(?:机器人|小鲸鱼|鲸鱼|大肥鱼)|\bdeepseek\b|\bd指导\b/iu.test(lower);
  };
  if (mentions(text)) return true;
  if (!/(?:他|它|这家伙|这货|这玩意|这东西)/u.test(text)) return false;
  const previous = recent.filter(m => now - Number(m.time || 0) <= 120000).slice(-3);
  return previous.some(m => m.isSelf === true || mentions(m.plain || m.text));
}
