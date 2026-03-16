// ═══════════════════════════════════════════════════════════════
// Hobo Network — Account Switcher
// Google-style multi-account management with anonymous mode.
// Persists sessions in localStorage, coordinates with server
// for token swapping. Integrates with HoboNavbar dropdown.
// Usage: HoboAccountSwitcher.init({ apiBase, onSwitch })
// ═══════════════════════════════════════════════════════════════

(function (root) {
    'use strict';

    const STORAGE_KEY = 'hobo_accounts';
    const TOKEN_KEY = 'hobo_token';
    const ACTIVE_KEY = 'hobo_active_account';
    const ANON_KEY = 'hobo_anon_token';
    const MAX_ACCOUNTS = 5;

    let _config = { apiBase: 'https://hobo.tools', onSwitch: null };
    let _panelEl = null;

    // ─── Account Store ─────────────────────────────────────────
    function getAccounts() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
    }

    function saveAccounts(accounts) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    }

    function getActiveId() {
        return localStorage.getItem(ACTIVE_KEY);
    }

    function setActiveId(id) {
        localStorage.setItem(ACTIVE_KEY, id);
    }

    function addAccount(user, token) {
        const accounts = getAccounts();
        const existing = accounts.findIndex(a => a.id === user.id);
        const entry = {
            id: user.id,
            username: user.username,
            display_name: user.display_name || user.username,
            avatar_url: user.avatar_url || null,
            email: user.email || null,
            is_anon: !!user.is_anon,
            anon_number: user.anon_number || null,
            token,
            added_at: Date.now(),
        };
        if (existing !== -1) {
            accounts[existing] = entry;
        } else {
            if (accounts.length >= MAX_ACCOUNTS) {
                accounts.shift(); // Remove oldest
            }
            accounts.push(entry);
        }
        saveAccounts(accounts);
        return accounts;
    }

    function removeAccount(id) {
        const accounts = getAccounts().filter(a => a.id !== id);
        saveAccounts(accounts);
        if (getActiveId() === String(id)) {
            if (accounts.length > 0) switchTo(accounts[0].id);
            else logout();
        }
        return accounts;
    }

    // ─── API ───────────────────────────────────────────────────
    async function apiFetch(path, opts = {}) {
        const token = localStorage.getItem(TOKEN_KEY);
        const headers = { 'Content-Type': 'application/json', ...opts.headers };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${_config.apiBase}${path}`, { ...opts, headers, credentials: 'include' });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
    }

    async function switchTo(accountId) {
        if (accountId === 'anon') return switchToAnon();

        const accounts = getAccounts();
        const target = accounts.find(a => String(a.id) === String(accountId));
        if (!target || !target.token) {
            // Token expired — need re-login
            window.location.href = `${_config.apiBase}/login?switch_to=${accountId}&return=${encodeURIComponent(window.location.href)}`;
            return;
        }

        // Validate token is still good
        try {
            const headers = { Authorization: `Bearer ${target.token}` };
            const res = await fetch(`${_config.apiBase}/api/auth/me`, { headers });
            if (!res.ok) throw new Error('Token invalid');
        } catch {
            // Token expired
            removeAccount(target.id);
            window.location.href = `${_config.apiBase}/login?switch_to=${accountId}&return=${encodeURIComponent(window.location.href)}`;
            return;
        }

        localStorage.setItem(TOKEN_KEY, target.token);
        setActiveId(target.id);

        if (_config.onSwitch) _config.onSwitch(target);
        else window.location.reload();
    }

    async function switchToAnon() {
        let anonToken = localStorage.getItem(ANON_KEY);

        if (!anonToken) {
            // Create anon session
            try {
                const data = await apiFetch('/api/auth/anon-session', { method: 'POST' });
                anonToken = data.token;
                localStorage.setItem(ANON_KEY, anonToken);
                if (data.user) addAccount(data.user, anonToken);
            } catch (err) {
                console.error('[HoboAccountSwitcher] Failed to create anon session:', err);
                return;
            }
        }

        localStorage.setItem(TOKEN_KEY, anonToken);
        setActiveId('anon');

        if (_config.onSwitch) _config.onSwitch({ id: 'anon', is_anon: true });
        else window.location.reload();
    }

    function logout() {
        const activeId = getActiveId();
        if (activeId) removeAccount(activeId);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(ACTIVE_KEY);
        document.cookie = 'hobo_token=;path=/;max-age=0;domain=.hobo.tools';
        if (_config.onSwitch) _config.onSwitch(null);
        else window.location.reload();
    }

    function logoutAll() {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(ACTIVE_KEY);
        localStorage.removeItem(ANON_KEY);
        document.cookie = 'hobo_token=;path=/;max-age=0;domain=.hobo.tools';
        if (_config.onSwitch) _config.onSwitch(null);
        else window.location.reload();
    }

    // ─── Switcher Panel UI ─────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('hobo-switcher-styles')) return;
        const s = document.createElement('style');
        s.id = 'hobo-switcher-styles';
        s.textContent = `
            .hobo-switcher-overlay {
                position: fixed; inset: 0; z-index: 20000;
                background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
                display: flex; align-items: center; justify-content: center;
                animation: hobo-sw-fadein .2s ease;
            }
            @keyframes hobo-sw-fadein { from { opacity: 0; } to { opacity: 1; } }

            .hobo-switcher-panel {
                width: 380px; max-height: 520px;
                background: var(--bg-card, #22222c);
                border: 1px solid var(--border, #333340); border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.6);
                overflow: hidden; animation: hobo-sw-pop .25s cubic-bezier(.34,1.56,.64,1);
            }
            @keyframes hobo-sw-pop { from { transform: scale(.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }

            .hobo-switcher-header {
                text-align: center; padding: 20px 16px 12px;
                border-bottom: 1px solid var(--border, #333340);
            }
            .hobo-switcher-header h3 { margin: 0 0 4px; font-size: 16px; font-weight: 700; color: var(--text-primary, #e0e0e0); }
            .hobo-switcher-header p { margin: 0; font-size: 12px; color: var(--text-muted, #707080); }

            .hobo-switcher-list { padding: 8px; max-height: 300px; overflow-y: auto; }

            .hobo-switcher-item {
                display: flex; align-items: center; gap: 12px; padding: 10px 12px;
                border-radius: 10px; cursor: pointer; transition: background .15s;
                position: relative;
            }
            .hobo-switcher-item:hover { background: var(--bg-hover, #2f2f3d); }
            .hobo-switcher-item.active { background: rgba(192,150,92,0.08); }
            .hobo-switcher-item.active::after {
                content: '✓'; position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
                color: var(--accent, #c0965c); font-weight: 700; font-size: 16px;
            }
            .hobo-switcher-item img { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; }
            .hobo-switcher-item .info { flex: 1; line-height: 1.3; }
            .hobo-switcher-item .info .name { font-size: 14px; font-weight: 600; color: var(--text-primary, #e0e0e0); }
            .hobo-switcher-item .info .sub { font-size: 11px; color: var(--text-muted, #707080); }
            .hobo-switcher-item .remove {
                opacity: 0; font-size: 14px; color: var(--live-red, #e74c3c);
                cursor: pointer; padding: 4px 6px; border-radius: 4px;
                transition: opacity .15s, background .15s;
            }
            .hobo-switcher-item:hover .remove { opacity: .6; }
            .hobo-switcher-item .remove:hover { opacity: 1; background: rgba(231,76,60,0.1); }

            .hobo-switcher-anon {
                display: flex; align-items: center; gap: 12px; padding: 10px 12px;
                margin: 0 8px 8px; border-radius: 10px; cursor: pointer;
                border: 1px dashed var(--border, #333340);
                transition: all .15s; color: var(--text-muted, #707080);
            }
            .hobo-switcher-anon:hover { background: var(--bg-hover, #2f2f3d); border-color: var(--accent-dark, #a07840); }
            .hobo-switcher-anon .anon-icon { font-size: 22px; width: 40px; text-align: center; }

            .hobo-switcher-actions {
                padding: 8px 12px; border-top: 1px solid var(--border, #333340);
                display: flex; gap: 8px; justify-content: center;
            }
            .hobo-switcher-actions button {
                flex: 1; padding: 8px; border: none; border-radius: 8px;
                font-size: 12px; font-weight: 600; cursor: pointer;
                transition: all .15s;
            }
            .hobo-switcher-actions .btn-add {
                background: var(--accent, #c0965c); color: #fff;
            }
            .hobo-switcher-actions .btn-add:hover { background: var(--accent-dark, #a07840); }
            .hobo-switcher-actions .btn-signout {
                background: rgba(231,76,60,0.1); color: var(--live-red, #e74c3c);
            }
            .hobo-switcher-actions .btn-signout:hover { background: rgba(231,76,60,0.2); }
        `;
        document.head.appendChild(s);
    }

    function showPanel() {
        if (_panelEl) return;
        injectStyles();

        const accounts = getAccounts();
        const activeId = getActiveId();

        const overlay = document.createElement('div');
        overlay.className = 'hobo-switcher-overlay';
        overlay.addEventListener('click', e => {
            if (e.target === overlay) closePanel();
        });

        const panel = document.createElement('div');
        panel.className = 'hobo-switcher-panel';

        panel.innerHTML = `
            <div class="hobo-switcher-header">
                <h3>🔥 Switch Account</h3>
                <p>Choose an account or browse anonymously</p>
            </div>
            <div class="hobo-switcher-list">
                ${accounts.map(a => `
                    <div class="hobo-switcher-item ${String(a.id) === String(activeId) ? 'active' : ''}" data-id="${a.id}">
                        <img src="${a.avatar_url || '/data/avatars/default.png'}" alt="">
                        <div class="info">
                            <div class="name">${a.display_name || a.username}${a.is_anon ? ' 👤' : ''}</div>
                            <div class="sub">${a.email || `@${a.username}`}${a.is_anon ? ` · Anon #${a.anon_number || '?'}` : ''}</div>
                        </div>
                        ${String(a.id) !== String(activeId) ? `<span class="remove" data-remove-id="${a.id}" title="Remove account">✕</span>` : ''}
                    </div>
                `).join('')}
            </div>
            <div class="hobo-switcher-anon" id="hobo-sw-anon">
                <span class="anon-icon">🫥</span>
                <div class="info">
                    <div class="name" style="color:var(--text-primary,#e0e0e0)">Anonymous Mode</div>
                    <div class="sub">Browse without an account · Limited features</div>
                </div>
            </div>
            <div class="hobo-switcher-actions">
                <button class="btn-add" id="hobo-sw-add">+ Add Account</button>
                <button class="btn-signout" id="hobo-sw-signout">Sign Out All</button>
            </div>
        `;

        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        _panelEl = overlay;

        // Wire events
        panel.querySelectorAll('.hobo-switcher-item[data-id]').forEach(el => {
            el.addEventListener('click', e => {
                if (e.target.closest('.remove')) return;
                switchTo(el.dataset.id);
                closePanel();
            });
        });

        panel.querySelectorAll('[data-remove-id]').forEach(el => {
            el.addEventListener('click', e => {
                e.stopPropagation();
                removeAccount(el.dataset.removeId);
                closePanel();
                showPanel(); // Re-render
            });
        });

        panel.querySelector('#hobo-sw-anon').addEventListener('click', () => {
            switchToAnon();
            closePanel();
        });

        panel.querySelector('#hobo-sw-add').addEventListener('click', () => {
            window.location.href = `${_config.apiBase}/login?add_account=1&return=${encodeURIComponent(window.location.href)}`;
        });

        panel.querySelector('#hobo-sw-signout').addEventListener('click', () => {
            logoutAll();
            closePanel();
        });

        // Esc to close
        const escHandler = e => { if (e.key === 'Escape') closePanel(); };
        document.addEventListener('keydown', escHandler);
        overlay._escHandler = escHandler;
    }

    function closePanel() {
        if (!_panelEl) return;
        document.removeEventListener('keydown', _panelEl._escHandler);
        _panelEl.remove();
        _panelEl = null;
    }

    // ─── Listen for navbar events ──────────────────────────────
    document.addEventListener('hobo-switch-account', e => {
        switchTo(e.detail.accountId);
    });

    // ─── Public API ────────────────────────────────────────────
    const HoboAccountSwitcher = {
        init(opts = {}) {
            Object.assign(_config, opts);
        },

        /** Call after login success to store this account. */
        addAccount,
        removeAccount,
        getAccounts,
        getActiveId,
        switchTo,
        switchToAnon,
        logout,
        logoutAll,

        /** Show the full-screen account switcher panel. */
        showPanel,
        closePanel,

        /** Quick check: is user on an anonymous session? */
        isAnonymous() {
            return getActiveId() === 'anon' || !!localStorage.getItem(ANON_KEY) && !localStorage.getItem(TOKEN_KEY);
        },

        /** Get the current active account object. */
        getActive() {
            const id = getActiveId();
            if (!id) return null;
            return getAccounts().find(a => String(a.id) === String(id)) || null;
        },
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = HoboAccountSwitcher;
    else root.HoboAccountSwitcher = HoboAccountSwitcher;

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
