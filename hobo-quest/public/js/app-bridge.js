/**
 * HoboQuest — App Bridge
 * Provides the global helpers (api, toast, currentUser, currentPage)
 * that game.js and canvas.js expect from the hobostreamer SPA.
 * Reads auth from the hobo_token cookie.
 */

/* ── Cookie → localStorage bridge ──────────────────────────── */
function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
}

// game.js/canvas.js read localStorage.getItem('token') for WebSocket auth
const cookieToken = getCookie('hobo_token');
if (cookieToken) {
    localStorage.setItem('token', cookieToken);
} else {
    localStorage.removeItem('token');
}

/* ── Globals expected by game.js / canvas.js ─────────────── */
let currentUser = null;
let currentPage = 'home'; // overridden per-page

/* ── Decode JWT payload (no verification — just for display) */
function decodeJwtPayload(token) {
    try {
        const payload = token.split('.')[1];
        return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch { return null; }
}

if (cookieToken) {
    const payload = decodeJwtPayload(cookieToken);
    if (payload) {
        currentUser = {
            id: payload.sub || payload.id,
            username: payload.username || payload.display_name || 'hobo',
            display_name: payload.display_name || payload.username || 'hobo',
            role: payload.role || 'user',
        };
    }
}

/* ── Auth headers ─────────────────────────────────────────── */
function authHeaders() {
    const tok = localStorage.getItem('token');
    return tok ? { Authorization: `Bearer ${tok}` } : {};
}

/* ── API helper (same contract as hobostreamer's app.js) ──── */
async function api(path, opts = {}) {
    const res = await fetch(`/api${path}`, {
        headers: { 'Content-Type': 'application/json', ...authHeaders(), ...opts.headers },
        ...opts,
        body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { status: res.status, message: data.error || 'Request failed', ...data };
    return data;
}

/* ── Toast notifications ──────────────────────────────────── */
function toast(msg, type = 'info') {
    let c = document.getElementById('toast-container');
    if (!c) {
        c = document.createElement('div');
        c.id = 'toast-container';
        c.style.cssText = 'position:fixed;top:16px;right:16px;z-index:10000;display:flex;flex-direction:column;gap:8px;pointer-events:none';
        document.body.appendChild(c);
    }
    const el = document.createElement('div');
    el.style.cssText = `
        padding:10px 16px;border-radius:8px;font-size:14px;color:#fff;pointer-events:auto;
        box-shadow:0 4px 12px rgba(0,0,0,0.4);transition:opacity 0.3s;
        background:${type === 'error' ? '#c0392b' : type === 'success' ? '#27ae60' : '#2980b9'};
    `;
    el.textContent = msg == null ? '' : String(msg);
    c.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 4000);
}

/* ── Stub: showModal (login/register on hobostreamer) ─────── */
function showModal(type) {
    if (type === 'login' || type === 'register') {
        window.location.href = '/auth/login';
    }
}
