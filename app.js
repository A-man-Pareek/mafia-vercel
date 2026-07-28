/**
 * Sigma Circle Math Club - Mafia: The Old Country
 * Slot Registration Application Core Logic
 */

document.addEventListener('DOMContentLoaded', () => {

  const SLOTS_CONFIG = {
    1: { id: 1, name: 'Slot 1', time: '2:00 PM – 3:00 PM', max: 15 },
    2: { id: 2, name: 'Slot 2', time: '3:00 PM – 4:00 PM', max: 15 },
    3: { id: 3, name: 'Slot 3', time: '4:00 PM – 5:00 PM', max: 15 }
  };

  let selectedSlot = null;
  let registrations = [];
  let adminToken = sessionStorage.getItem('mafia_admin_token');
  let adminAuthenticated = Boolean(adminToken);
  const API_BASE = window.MAFIA_API_BASE || '/api';
  const ADMIN_API_BASE = `${API_BASE}/admin`;
  const LOCAL_ADMIN_CREDENTIALS = { username: 'Aman', password: 'AmanPareek' };
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOGIN_LOCKOUT_MS = 10 * 60 * 1000;
  let loginAttempts = Number(sessionStorage.getItem('mafia_admin_login_attempts') || 0);
  let loginLockedUntil = Number(sessionStorage.getItem('mafia_admin_lock_until') || 0);

  const slotCards = document.querySelectorAll('.slot-card');
  const studentNameInput = document.getElementById('studentName');
  const studentPhoneInput = document.getElementById('studentPhone');
  const studentYearInput = document.getElementById('studentYear');
  const studentSpecificationsInput = document.getElementById('studentSpecifications');
  const submitBtn = document.getElementById('submitBtn');
  const registrationForm = document.getElementById('registrationForm');

  const ticketModal = document.getElementById('ticketModal');
  const closeTicketBtn = document.getElementById('closeTicketBtn');
  const doneTicketBtn = document.getElementById('doneTicketBtn');
  const printTicketBtn = document.getElementById('printTicketBtn');
  const successModal = document.getElementById('successModal');
  const closeSuccessBtn = document.getElementById('closeSuccessBtn');
  const doneSuccessBtn = document.getElementById('doneSuccessBtn');

  const adminModal = document.getElementById('adminModal');
  const adminLoginModal = document.getElementById('adminLoginModal');
  const openAdminBtn = document.getElementById('openAdminBtn');
  const closeAdminBtn = document.getElementById('closeAdminBtn');
  const closeAdminLoginBtn = document.getElementById('closeAdminLoginBtn');
  const adminTableBody = document.getElementById('adminTableBody');
  const adminSearchInput = document.getElementById('adminSearchInput');
  const fillSampleDataBtn = document.getElementById('fillSampleDataBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const resetDbBtn = document.getElementById('resetDbBtn');
  const adminLogoutBtn = document.getElementById('adminLogoutBtn');
  const adminAuthStatus = document.getElementById('adminAuthStatus');
  const slotSummaryContainer = document.getElementById('slotSummaryContainer');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const adminUsernameInput = document.getElementById('adminUsernameInput');
  const adminPasswordInput = document.getElementById('adminPasswordInput');
  const adminLoginError = document.getElementById('adminLoginError');

  init();

  async function init() {
    setupEventListeners();
    await fetchRegistrations();
    updateUI();
    if (adminToken) {
      await verifyAdminSession();
    }
    renderAdminTable();
    renderSlotSummary();
  }

  function setupEventListeners() {
    slotCards.forEach(card => {
      card.addEventListener('click', () => {
        if (card.classList.contains('disabled')) {
          showToast('This slot is fully booked!', 'warning');
          return;
        }
        selectSlot(parseInt(card.dataset.slot));
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
      });
    });

    studentNameInput.addEventListener('input', validateForm);
    studentPhoneInput.addEventListener('input', validateForm);
    studentYearInput.addEventListener('input', validateForm);
    studentSpecificationsInput.addEventListener('input', validateForm);
    registrationForm.addEventListener('submit', handleRegistrationSubmit);

    closeTicketBtn.addEventListener('click', () => hideModal(ticketModal));
    doneTicketBtn.addEventListener('click', () => hideModal(ticketModal));
    printTicketBtn.addEventListener('click', () => window.print());
    closeSuccessBtn.addEventListener('click', () => hideModal(successModal));
    doneSuccessBtn.addEventListener('click', () => hideModal(successModal));

    openAdminBtn.addEventListener('click', handleOpenAdmin);
    closeAdminBtn.addEventListener('click', () => hideModal(adminModal));
    closeAdminLoginBtn.addEventListener('click', () => hideModal(adminLoginModal));

    adminSearchInput.addEventListener('input', renderAdminTable);
    fillSampleDataBtn.addEventListener('click', handleFillSampleData);
    exportCsvBtn.addEventListener('click', exportToCSV);
    resetDbBtn.addEventListener('click', handleResetDatabase);
    adminLogoutBtn.addEventListener('click', handleAdminLogout);
    adminLoginForm.addEventListener('submit', handleAdminLogin);
  }

  function selectSlot(slotId) {
    selectedSlot = slotId;
    slotCards.forEach(card => {
      card.classList.toggle('selected', parseInt(card.dataset.slot) === slotId);
    });
    validateForm();
  }

  function validateForm() {
    const nameValid = studentNameInput.value.trim().length >= 2;
    const phoneValid = studentPhoneInput.value.trim().length >= 10;
    const yearValid = studentYearInput.value.trim().length >= 2;
    const slotValid = selectedSlot !== null && getSlotCount(selectedSlot) < SLOTS_CONFIG[selectedSlot].max;
    submitBtn.disabled = !(nameValid && phoneValid && yearValid && slotValid);
  }

  function getSlotCount(slotId) {
    return registrations.filter(r => parseInt(r.slot) === parseInt(slotId)).length;
  }

  async function fetchRegistrations() {
    try {
      const res = await fetch(`${API_BASE}/users`);
      if (res.ok) { registrations = await res.json(); }
      else { throw new Error('API unavailable'); }
    } catch (err) {
      const localData = localStorage.getItem('mafia_users_db');
      registrations = localData ? JSON.parse(localData) : [];
    }
  }

  function updateUI() {
    [1, 2, 3].forEach(slotId => {
      const count = getSlotCount(slotId);
      const remaining = Math.max(0, SLOTS_CONFIG[slotId].max - count);
      const countEl = document.getElementById(`slotCount${slotId}`);
      const badgeEl = document.getElementById(`slotBadge${slotId}`);
      const cardEl = document.querySelector(`.slot-card[data-slot="${slotId}"]`);

      if (countEl) countEl.textContent = remaining;
      if (cardEl && badgeEl) {
        if (remaining === 0) {
          cardEl.classList.add('disabled'); cardEl.classList.remove('selected');
          if (selectedSlot === slotId) selectedSlot = null;
          badgeEl.className = 'seat-count-badge full';
          badgeEl.innerHTML = `<i class="fa-solid fa-lock"></i> 0 / 15`;
        } else if (remaining <= 3) {
          cardEl.classList.remove('disabled');
          badgeEl.className = 'seat-count-badge warning';
          badgeEl.innerHTML = `<i class="fa-solid fa-fire"></i> ${remaining} / 15`;
        } else {
          cardEl.classList.remove('disabled');
          badgeEl.className = 'seat-count-badge available';
          badgeEl.innerHTML = `<i class="fa-solid fa-user-check"></i> ${remaining} / 15`;
        }
      }
    });
    validateForm();
  }

  async function handleRegistrationSubmit(e) {
    e.preventDefault();
    const name = studentNameInput.value.trim();
    const phone = studentPhoneInput.value.trim();
    const year = studentYearInput.value.trim();
    const specifications = studentSpecificationsInput.value.trim();
    const slot = selectedSlot;
    if (!name || !phone || !year || !slot) return;

    if (getSlotCount(slot) >= SLOTS_CONFIG[slot].max) {
      showToast(`Slot ${slot} is full! Please choose another slot.`, 'error');
      updateUI(); return;
    }

    const newUser = { id: Date.now(), name, phone, year, specifications, slot: parseInt(slot) };

    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      if (!res.ok) { throw new Error('Registration failed'); }
    } catch (err) {
      registrations.push(newUser);
      localStorage.setItem('mafia_users_db', JSON.stringify(registrations));
    }

    await fetchRegistrations();
    updateUI();

    studentNameInput.value = '';
    studentPhoneInput.value = '';
    studentYearInput.value = '';
    studentSpecificationsInput.value = '';
    const registeredSlotId = selectedSlot;
    selectedSlot = null;
    slotCards.forEach(c => c.classList.remove('selected'));

    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch (err) {
      // vibration not supported
    }
    showModal(successModal);
    showToast('Registration Successful! Ticket generated.', 'success');
    showToast('Your registration was saved successfully.', 'success');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('mafia:success'));
    }
    window.alert('Registration successful!');
  }

  function showTicketPass(user, slotId) {
    document.getElementById('passName').textContent = user.name;
    document.getElementById('passPhone').textContent = user.phone;
    document.getElementById('passYear').textContent = user.year || 'Not provided';
    document.getElementById('passSpecifications').textContent = user.specifications || 'Not provided';
    document.getElementById('passSlot').textContent = `Slot ${slotId} (${SLOTS_CONFIG[slotId].time})`;
    document.getElementById('passIdCode').textContent = `PASS #SIGMA-${String(user.id).slice(-4)}`;
    showModal(ticketModal);
  }

  function handleOpenAdmin() {
    if (adminAuthenticated && adminToken) {
      renderAdminTable();
      renderSlotSummary();
      showModal(adminModal);
      return;
    }
    showModal(adminLoginModal);
    adminUsernameInput.focus();
  }

  function isLoginLocked() {
    if (loginLockedUntil && Date.now() < loginLockedUntil) {
      return true;
    }
    if (loginLockedUntil && Date.now() >= loginLockedUntil) {
      loginLockedUntil = 0;
      loginAttempts = 0;
      sessionStorage.removeItem('mafia_admin_lock_until');
      sessionStorage.removeItem('mafia_admin_login_attempts');
    }
    return false;
  }

  function handleLoginFailure() {
    loginAttempts += 1;
    sessionStorage.setItem('mafia_admin_login_attempts', String(loginAttempts));
    if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      loginLockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
      sessionStorage.setItem('mafia_admin_lock_until', String(loginLockedUntil));
      adminLoginError.textContent = 'Too many failed attempts. Please wait 10 minutes before trying again.';
      return;
    }
    adminLoginError.textContent = `Invalid credentials. ${MAX_LOGIN_ATTEMPTS - loginAttempts} attempt(s) remaining.`;
  }

  function grantAdminAccess(token = null) {
    adminToken = token || `local-${Date.now()}`;
    adminAuthenticated = true;
    sessionStorage.setItem('mafia_admin_token', adminToken);
    sessionStorage.setItem('mafia_admin_login_attempts', '0');
    sessionStorage.removeItem('mafia_admin_lock_until');
    loginAttempts = 0;
    loginLockedUntil = 0;
    adminLoginError.textContent = '';
    adminUsernameInput.value = '';
    adminPasswordInput.value = '';
    hideModal(adminLoginModal);
    renderAdminTable();
    renderSlotSummary();
    showModal(adminModal);
    showToast('Admin access granted.', 'success');
  }

  async function handleAdminLogin(e) {
    e.preventDefault();
    if (isLoginLocked()) {
      adminLoginError.textContent = 'Access is temporarily locked. Please try again shortly.';
      return;
    }

    const username = adminUsernameInput.value.trim();
    const password = adminPasswordInput.value.trim();
    if (!username || !password) {
      adminLoginError.textContent = 'Enter both username and password.';
      return;
    }

    if (username === LOCAL_ADMIN_CREDENTIALS.username && password === LOCAL_ADMIN_CREDENTIALS.password) {
      grantAdminAccess();
      return;
    }

    try {
      const res = await fetch(`${ADMIN_API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        handleLoginFailure();
        return;
      }

      grantAdminAccess(data.token);
    } catch (err) {
      handleLoginFailure();
    }
  }

  async function verifyAdminSession() {
    if (!adminToken) {
      adminAuthenticated = false;
      return false;
    }
    try {
      const res = await fetch(`${ADMIN_API_BASE}/verify`, {
        headers: { 'X-Admin-Token': adminToken }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.valid) {
        adminAuthenticated = true;
        return true;
      }
    } catch (err) {
      // ignore and fall back to local session
    }
    adminAuthenticated = false;
    adminToken = null;
    sessionStorage.removeItem('mafia_admin_token');
    return false;
  }

  async function handleAdminLogout() {
    if (adminToken) {
      try {
        await fetch(`${ADMIN_API_BASE}/logout`, {
          method: 'POST',
          headers: { 'X-Admin-Token': adminToken }
        });
      } catch (err) {
        // ignore
      }
    }
    adminToken = null;
    adminAuthenticated = false;
    sessionStorage.removeItem('mafia_admin_token');
    sessionStorage.removeItem('mafia_admin_login_attempts');
    sessionStorage.removeItem('mafia_admin_lock_until');
    loginAttempts = 0;
    loginLockedUntil = 0;
    hideModal(adminModal);
    showModal(adminLoginModal);
    adminLoginError.textContent = '';
    adminUsernameInput.value = '';
    adminPasswordInput.value = '';
    showToast('Logged out from admin panel.', 'info');
  }

  function renderAdminTable() {
    const query = adminSearchInput.value.toLowerCase().trim();
    const filtered = registrations.filter(r =>
      (r.name || '').toLowerCase().includes(query) ||
      (r.phone || '').toLowerCase().includes(query) ||
      (r.year || '').toLowerCase().includes(query) ||
      (r.specifications || '').toLowerCase().includes(query)
    );

    document.getElementById('adminTotalCount').textContent = registrations.length;
    document.getElementById('adminOpenSeats').textContent = 45 - registrations.length;
    let closedCount = 0;
    [1, 2, 3].forEach(s => { if (getSlotCount(s) >= 15) closedCount++; });
    document.getElementById('adminFullSlotsCount').textContent = closedCount;
    if (adminAuthStatus) {
      adminAuthStatus.textContent = adminAuthenticated ? 'Signed in as Aman' : 'Not signed in';
    }

    if (filtered.length === 0) {
      adminTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:2rem;">No participants found.</td></tr>`;
      return;
    }
    adminTableBody.innerHTML = filtered.map(user => `
      <tr>
        <td>#${user.id}</td>
        <td><strong>${escapeHtml(user.name || '')}</strong></td>
        <td>${escapeHtml(user.phone || '')}</td>
        <td>${escapeHtml(user.year || '-')}</td>
        <td>${escapeHtml((user.specifications || '').length > 60 ? (user.specifications || '').slice(0, 60) + '…' : (user.specifications || '-'))}</td>
        <td><span class="seat-count-badge available">Slot ${user.slot}</span></td>
        <td><button class="delete-btn" onclick="deleteUser(${user.id})" title="Delete"><i class="fa-solid fa-trash"></i></button></td>
      </tr>
    `).join('');
  }

  function renderSlotSummary() {
    if (!slotSummaryContainer) return;
    const summary = [1, 2, 3].map(slotId => {
      const entries = registrations.filter(r => parseInt(r.slot) === slotId);
      return `
        <div class="slot-summary-card">
          <div class="slot-summary-title">Slot ${slotId}</div>
          <div class="slot-summary-count">${entries.length} registered</div>
          <ul class="slot-summary-list">
            ${entries.length > 0 ? entries.map(entry => `<li>${escapeHtml(entry.name || 'Unnamed')} • ${escapeHtml(entry.phone || '-')}</li>`).join('') : '<li>No registrations yet.</li>'}
          </ul>
        </div>
      `;
    }).join('');
    slotSummaryContainer.innerHTML = summary;
  }

  window.deleteUser = async function(id) {
    if (!confirm('Remove this participant?')) return;
    const normalizedId = Number(id);
    if (!Number.isFinite(normalizedId)) {
      showToast('Invalid participant ID.', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(normalizedId)}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Delete request failed');
      }

      registrations = registrations.filter(r => Number(r.id) !== normalizedId);
      localStorage.setItem('mafia_users_db', JSON.stringify(registrations));
      await fetchRegistrations();
      updateUI();
      renderAdminTable();
      renderSlotSummary();
      showToast('Participant deleted.', 'info');
    } catch (e) {
      showToast('Unable to delete participant from the database.', 'error');
    }
  };

  async function handleFillSampleData() {
    const names = ['Dominic Toretto', 'Vito Corleone', 'Michael Corleone', 'Sonny Corleone', 'Tom Hagen', 'Clemenza', 'Tessio', 'Luca Brasi', 'Fredo Corleone', 'Paulie Gatto', 'Johnny Fontane', 'Sal Neri', 'Willie Cicci', 'Frank Pentangeli', 'Enzo the Baker'];
    const slot1Count = getSlotCount(1);
    const needed = 15 - slot1Count;
    if (needed <= 0) { showToast('Slot 1 is already full!', 'info'); return; }

    for (let i = 0; i < needed; i++) {
      const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
      registrations.push({ id: Date.now() + i, name: `${names[i % names.length]} (${i + 1})`, phone: `+1 555 010 ${1000 + i}`, year: years[i % years.length], specifications: `Sample note ${i + 1}`, slot: 1 });
    }
    localStorage.setItem('mafia_users_db', JSON.stringify(registrations));
    try { await fetch(`${API_BASE}/seed`, { method: 'POST', body: JSON.stringify(registrations) }); } catch (e) {}
    await fetchRegistrations();
    updateUI();
    renderAdminTable();
    renderSlotSummary();
    showToast(`Added ${needed} test entries. Slot 1 is now FULL!`, 'success');
  }

  function exportToCSV() {
    if (registrations.length === 0) { showToast('No data to export!', 'warning'); return; }
    const headers = ['ID', 'Name', 'Phone', 'Year', 'Specifications', 'Slot', 'Slot_Time'];
    const rows = registrations.map(r => [r.id, `"${(r.name || '').replace(/"/g, '""')}"`, `"${r.phone || ''}"`, `"${(r.year || '').replace(/"/g, '""')}"`, `"${(r.specifications || '').replace(/"/g, '""')}"`, r.slot, `"${SLOTS_CONFIG[r.slot] ? SLOTS_CONFIG[r.slot].time : ''}"`]);
    const csv = `data:text/csv;charset=utf-8,${[headers.join(','), ...rows.map(e => e.join(','))].join('\n')}`;
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `mafia_registrations_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported to CSV', 'success');
  }

  async function handleResetDatabase() {
    if (!confirm('Delete ALL registrations? This cannot be undone.')) return;
    registrations = [];
    localStorage.removeItem('mafia_users_db');
    try { await fetch(`${ADMIN_API_BASE}/reset`, { method: 'POST', headers: { 'X-Admin-Token': adminToken || '' } }); } catch (e) {}
    await fetchRegistrations();
    updateUI();
    renderAdminTable();
    renderSlotSummary();
    showToast('Database reset.', 'info');
  }

  function showModal(m) { m.classList.add('active'); }
  function hideModal(m) { m.classList.remove('active'); }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { info: 'fa-circle-info', success: 'fa-circle-check', warning: 'fa-triangle-exclamation', error: 'fa-circle-exclamation' };
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; setTimeout(() => toast.remove(), 300); }, 3500);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
  }

});
