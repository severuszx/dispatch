function cloneBranch(b, suffix) {
  return { ...b, id: `${b.id}-${suffix}` };
}

function variant(ev, suffix, lead, radioLead, tags) {
  return {
    ...ev,
    id: `${ev.id}-${suffix}`,
    code: `${ev.code}-${suffix}`,
    desc: `${lead}${ev.desc || ''}`,
    radio: ev.radio ? `${radioLead}${ev.radio}` : ev.radio,
    tags: [...(ev.tags || []), ...tags],
    branches: (ev.branches || []).map((b) => cloneBranch(b, suffix)),
  };
}

export function expandEvents(events) {
  if (!Array.isArray(events) || !events.length) return events || [];
  if (events.length >= 1800) return events;
  const out = events.slice();
  for (const ev of events) {
    out.push(variant(ev, 'night', '夜间，', '夜班电台里，', ['夜间', '低能见度']));
    out.push(variant(ev, 'rain', '雨天，', '雨声盖住电台，', ['雨天', '湿滑']));
  }
  return out;
}
