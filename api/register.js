const { getSupabaseClient, setCors, handleOptions, getJsonBody, sendJson } = require('./lib/supabase');

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const user = await getJsonBody(req);
    const payload = {
      id: user.id || Date.now(),
      name: user.name || '',
      phone: user.phone || '',
      year: user.year || '',
      specifications: user.specifications || '',
      slot: Number(user.slot)
    };

    const supabase = getSupabaseClient();
    const { count, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('slot', payload.slot);

    if (countError) throw countError;

    if (count >= 15) {
      sendJson(res, 400, { error: 'SLOT_FULL', message: `Slot ${payload.slot} has reached maximum capacity of 15 participants.` });
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .insert([payload])
      .select();

    if (error) throw error;

    sendJson(res, 200, { success: true, message: 'Registration successful', user: data[0] });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
};
