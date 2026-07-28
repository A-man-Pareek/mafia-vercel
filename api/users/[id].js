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
    const rawId = req.query?.id ?? req.query?.[0] ?? req.body?.id;
    const numericId = Number(rawId);

    if (!Number.isFinite(numericId)) {
      sendJson(res, 400, { error: 'INVALID_ID' });
      return;
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', numericId);

    if (error) throw error;

    sendJson(res, 200, { success: true });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
};
