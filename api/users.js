const { getSupabaseClient, setCors, handleOptions, sendJson } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('id', { ascending: false });

    if (error) throw error;

    sendJson(res, 200, data || []);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
};
