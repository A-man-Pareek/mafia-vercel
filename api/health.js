const { getSupabaseClient, setCors, handleOptions, sendJson } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  // Check for env presence and try a lightweight Supabase call
  try {
    let envOk = true;
    try { getSupabaseClient(); } catch (e) { envOk = false; }

    if (!envOk) {
      sendJson(res, 200, { envSet: false, supabaseConnected: false, message: 'Supabase env vars not set in runtime.' });
      return;
    }

    const supabase = getSupabaseClient();
    const { data, error, status } = await supabase.from('users').select('id', { head: true, count: 'exact' });
    if (error) {
      sendJson(res, 200, { envSet: true, supabaseConnected: false, error: error.message || String(error), status });
      return;
    }

    sendJson(res, 200, { envSet: true, supabaseConnected: true, totalUsers: data ? data.length : 0 });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
};
