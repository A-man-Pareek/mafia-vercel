const { getSupabaseClient, setCors, handleOptions, sendJson } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'DELETE') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const supabase = getSupabaseClient();
    const pathId = req.query?.id || req.query?.[0] || req.params?.id || req.body?.id;
    const rawId = req.query?.id ?? req.query?.[0] ?? req.body?.id ?? pathId;
    const numericId = Number(rawId);

    if (!Number.isFinite(numericId)) {
      sendJson(res, 400, { success: false, error: 'INVALID_ID' });
      return;
    }

    const { error, count } = await supabase
      .from('users')
      .delete()
      .eq('id', numericId)
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    sendJson(res, 200, { success: true, deletedCount: count ?? 0 });
  } catch (error) {
    sendJson(res, 500, { success: false, error: error.message });
  }
};
