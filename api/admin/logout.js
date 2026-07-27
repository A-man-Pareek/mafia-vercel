const { setCors, handleOptions, sendJson } = require('../lib/supabase');

const adminTokenStore = new Map();

module.exports = async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const token = req.headers['x-admin-token'] || req.headers['X-Admin-Token'];
  if (token) {
    adminTokenStore.delete(token);
  }

  sendJson(res, 200, { success: true, message: 'Logged out' });
};
