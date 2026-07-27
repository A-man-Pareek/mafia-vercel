const { setCors, handleOptions, getJsonBody, sendJson } = require('../lib/supabase');

const adminTokenStore = new Map();

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await getJsonBody(req);
    const username = body.username;
    const password = body.password;

    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
      const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      adminTokenStore.set(token, { username });
      sendJson(res, 200, { success: true, token, username, expiresIn: 1800 });
      return;
    }

    sendJson(res, 401, { success: false, error: 'INVALID_CREDENTIALS' });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
};
