// Keyset pagination avoids the API row cap and offset shifts between pages.
export async function supportHistory(client) {
  const rows = [];
  let cursor = null;
  for (;;) {
    let query = client.from('supports').select('id,user_id,production_id,tier,billing_mode,amount,payment_status,paid_at,created_at,provider_payment_id,provider_checkout_id,productions(title,slug)').order('id', { ascending: true }).range(0, 499);
    if (cursor) query = query.gt('id', cursor);
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    const next = data[data.length - 1].id;
    if (next === cursor) throw new Error('Não foi possível carregar o histórico completo de apoios.');
    cursor = next;
  }
  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return { data: rows, error: null };
}
