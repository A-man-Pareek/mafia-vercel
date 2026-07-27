const { getSupabaseClient, setCors, handleOptions, sendJson } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('users').delete().gt('id', 0);

    if (error) throw error;

    sendJson(res, 200, { success: true, message: 'Database reset' });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
};
