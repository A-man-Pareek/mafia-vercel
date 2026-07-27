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
    const id = req.query?.id;

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', Number(id));

    if (error) throw error;

    sendJson(res, 200, { success: true });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
};
