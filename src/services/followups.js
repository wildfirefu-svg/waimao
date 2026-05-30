export function nextFollowUpDate(from = new Date(), days = 5) {
  const date = new Date(from);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function listDueFollowups(leads, now = new Date()) {
  const nowTime = now.getTime();
  return leads.filter((lead) => {
    if (!lead.next_follow_up_at || lead.status === 'Unsubscribed') return false;
    return new Date(lead.next_follow_up_at).getTime() <= nowTime;
  });
}
