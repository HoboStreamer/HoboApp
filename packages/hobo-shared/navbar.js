// ═══════════════════════════════════════════════════════════════
// Hobo Network — Universal Navbar
// Consistent top bar across all services with logo, navigation,
// notification bell, account switcher, and theme-aware styling.
// Usage: HoboNavbar.init({ service, token, user, apiBase })
// ═══════════════════════════════════════════════════════════════

(function (root) {
    'use strict';

    let _config = { service: 'hobotools', token: null, user: null, apiBase: 'https://hobo.tools', onLogin: null, onLogout: null };
    let _navEl = null;

    function injectStyles() {
        if (document.getElementById('hobo-navbar-styles')) return;
        const s = document.createElement('style');
        s.id = 'hobo-navbar-styles';
        s.textContent = `
            .hobo-navbar {
                position: sticky; top: 0; z-index: 10000;
                height: 52px; display: flex; align-items: center; padding: 0 16px; gap: 8px;
                background: var(--bg-secondary, #252530);
                border-bottom: 1px solid var(--border, #333340);
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                color: var(--text-primary, #e0e0e0);
            }
            .hobo-navbar-brand { display: flex; align-items: center; gap: 8px; text-decoration: none; color: inherit; margin-right: 8px; }
            .hobo-navbar-brand .flame { font-size: 22px; }
            .hobo-navbar-brand .name { font-size: 15px; font-weight: 700; letter-spacing: -.3px; }
            .hobo-navbar-brand .service-name { font-size: 11px; color: var(--accent-light, #dbb077); font-weight: 500; letter-spacing: .5px; text-transform: uppercase; }

            .hobo-navbar-links { display: flex; align-items: center; gap: 4px; margin-left: 8px; }
            .hobo-navbar-links a {
                padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 500;
                color: var(--text-secondary, #b0b0b8); text-decoration: none;
                transition: all .15s;
            }
            .hobo-navbar-links a:hover { background: var(--bg-hover, #2f2f3d); color: var(--text-primary, #e0e0e0); }
            .hobo-navbar-links a.active { background: var(--bg-tertiary, #2a2a38); color: var(--accent-light, #dbb077); }

            .hobo-navbar-spacer { flex: 1; }

            .hobo-navbar-right { display: flex; align-items: center; gap: 6px; }

            .hobo-navbar-avatar {
                width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
                border: 2px solid var(--border, #333340); transition: border-color .2s;
                object-fit: cover;
            }
            .hobo-navbar-avatar:hover { border-color: var(--accent, #c0965c); }

            .hobo-navbar-login {
                padding: 6px 16px; border-radius: 6px; font-size: 13px; font-weight: 600;
                background: var(--accent, #c0965c); color: #fff; border: none; cursor: pointer;
                transition: background .15s;
            }
            .hobo-navbar-login:hover { background: var(--accent-dark, #a07840); }

            .hobo-navbar-dropdown {
                position: absolute; top: 48px; right: 8px;
                width: 260px; background: var(--bg-card, #22222c);
                border: 1px solid var(--border, #333340); border-radius: 10px;
                box-shadow: var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.5));
                display: none; flex-direction: column; overflow: hidden;
                animation: hobo-slide-down .2s ease;
            }
            .hobo-navbar-dropdown.open { display: flex; }
            @keyframes hobo-slide-down { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

            .hobo-navbar-dropdown-header {
                padding: 14px 16px; border-bottom: 1px solid var(--border, #333340);
                display: flex; align-items: center; gap: 10px;
            }
            .hobo-navbar-dropdown-header img { width: 36px; height: 36px; border-radius: 50%; }
            .hobo-navbar-dropdown-header .info { line-height: 1.3; }
            .hobo-navbar-dropdown-header .info .name { font-size: 14px; font-weight: 600; }
            .hobo-navbar-dropdown-header .info .email { font-size: 11px; color: var(--text-muted, #707080); }
            .hobo-navbar-dropdown-header .info .anon-tag { font-size: 10px; color: var(--accent-light, #dbb077); }

            .hobo-navbar-dropdown-accounts {
                padding: 6px 8px; border-bottom: 1px solid var(--border, #333340);
                max-height: 140px; overflow-y: auto;
            }
            .hobo-navbar-dropdown-accounts .account-item {
                display: flex; align-items: center; gap: 8px; padding: 6px 8px;
                border-radius: 6px; cursor: pointer; font-size: 12px;
                color: var(--text-secondary, #b0b0b8); transition: background .12s;
            }
            .hobo-navbar-dropdown-accounts .account-item:hover { background: var(--bg-hover, #2f2f3d); }
            .hobo-navbar-dropdown-accounts .account-item img { width: 24px; height: 24px; border-radius: 50%; }
            .hobo-navbar-dropdown-accounts .account-item.active { color: var(--accent-light, #dbb077); font-weight: 600; }
            .hobo-navbar-dropdown-accounts .add-account {
                display: flex; align-items: center; gap: 8px; padding: 6px 8px;
                border-radius: 6px; cursor: pointer; font-size: 12px;
                color: var(--text-muted, #707080); transition: background .12s;
            }
            .hobo-navbar-dropdown-accounts .add-account:hover { background: var(--bg-hover, #2f2f3d); color: var(--text-primary, #e0e0e0); }

            .hobo-navbar-dropdown-menu { padding: 6px 8px; }
            .hobo-navbar-dropdown-menu a, .hobo-navbar-dropdown-menu button {
                display: flex; align-items: center; gap: 8px; width: 100%;
                padding: 8px; border-radius: 6px; font-size: 12px; font-weight: 500;
                background: none; border: none; color: var(--text-primary, #e0e0e0);
                cursor: pointer; text-align: left; text-decoration: none;
                transition: background .12s;
            }
            .hobo-navbar-dropdown-menu a:hover, .hobo-navbar-dropdown-menu button:hover { background: var(--bg-hover, #2f2f3d); }
            .hobo-navbar-dropdown-menu .danger { color: var(--live-red, #e74c3c); }
            .hobo-navbar-dropdown-menu .icon { width: 18px; text-align: center; font-size: 14px; }

            .hobo-navbar .hobo-network-badge {
                font-size: 10px; padding: 2px 8px; border-radius: 4px;
                background: rgba(192,150,92,0.1); color: var(--accent-light, #dbb077);
                font-weight: 500; cursor: pointer; border: 1px solid transparent;
                transition: all .15s;
            }
            .hobo-navbar .hobo-network-badge:hover { border-color: var(--accent-dark, #a07840); }

            @media (max-width: 600px) {
                .hobo-navbar-links { display: none; }
                .hobo-navbar .hobo-network-badge { display: none; }
            }
        `;
        document.head.appendChild(s);
    }

    const SERVICE_NAMES = {
        hobostreamer: 'HoboStreamer', hoboquest: 'HoboQuest',
        hobotools: 'HoboTools', hobomaps: 'HoboMaps',
    };

    const SERVICE_LINKS = {
        hobostreamer: [
            { label: 'Watch', href: '/' },
            { label: 'Chat', href: '/chat' },
            { label: 'VODs', href: '/vods' },
            { label: 'Game', href: '/game' },
        ],
        hoboquest: [
            { label: 'Play', href: '/game' },
            { label: 'Canvas', href: '/canvas' },
            { label: 'Leaderboard', href: '/leaderboard' },
        ],
        hobotools: [
            { label: 'Home', href: '/' },
            { label: 'Themes', href: '/themes' },
        ],
        hobomaps: [
            { label: 'Map', href: '/' },
            { label: 'Camps', href: '/camps' },
        ],
    };

    function getAccounts() {
        try { return JSON.parse(localStorage.getItem('hobo_accounts') || '[]'); } catch { return []; }
    }

    function render() {
        if (_navEl) _navEl.remove();

        const nav = document.createElement('nav');
        nav.className = 'hobo-navbar';
        const svc = _config.service;
        const svcName = SERVICE_NAMES[svc] || 'Hobo';
        const links = SERVICE_LINKS[svc] || [];

        const u = _config.user;
        const accounts = getAccounts();
        const isAnon = u && u.is_anon;

        nav.innerHTML = `
            <a class="hobo-navbar-brand" href="/">
                <span class="flame">🔥</span>
                <div>
                    <div class="name">${svcName}</div>
                </div>
            </a>
            <div class="hobo-navbar-links">
                ${links.map(l => `<a href="${l.href}">${l.label}</a>`).join('')}
            </div>
            <div class="hobo-navbar-spacer"></div>
            <div class="hobo-navbar-right">
                <span class="hobo-network-badge" title="Connected to Hobo Network">🔥 Hobo Network</span>
                <div id="hobo-bell-mount"></div>
                ${u ? `<img class="hobo-navbar-avatar" src="${u.avatar_url || '/data/avatars/default.png'}" alt="${u.username}" id="hobo-avatar-btn">` :
                    `<button class="hobo-navbar-login" id="hobo-login-btn">Sign In</button>`}
            </div>
        `;

        // Dropdown
        if (u) {
            const dropdown = document.createElement('div');
            dropdown.className = 'hobo-navbar-dropdown';
            dropdown.id = 'hobo-user-dropdown';

            const otherAccounts = accounts.filter(a => a.id !== u.id);

            dropdown.innerHTML = `
                <div class="hobo-navbar-dropdown-header">
                    <img src="${u.avatar_url || '/data/avatars/default.png'}" alt="">
                    <div class="info">
                        <div class="name">${u.display_name || u.username}</div>
                        <div class="email">${u.email || `@${u.username}`}</div>
                        ${isAnon ? `<div class="anon-tag">Anonymous #${u.anon_number || '?'}</div>` : ''}
                    </div>
                </div>
                <div class="hobo-navbar-dropdown-accounts">
                    ${otherAccounts.map(a => `
                        <div class="account-item" data-account-id="${a.id}">
                            <img src="${a.avatar_url || '/data/avatars/default.png'}" alt="">
                            <span>${a.display_name || a.username}${a.is_anon ? ' (anon)' : ''}</span>
                        </div>
                    `).join('')}
                    <div class="account-item" data-account-id="anon" style="${isAnon ? 'display:none' : ''}">
                        <span style="width:24px;text-align:center">👤</span>
                        <span>Switch to Anonymous</span>
                    </div>
                    <div class="add-account" id="hobo-add-account">
                        <span style="width:24px;text-align:center">➕</span>
                        <span>Add another account</span>
                    </div>
                </div>
                <div class="hobo-navbar-dropdown-menu">
                    <a href="https://hobo.tools/my"><span class="icon">👤</span> My Account</a>
                    <a href="https://hobo.tools/my#notifications"><span class="icon">🔔</span> Notification Settings</a>
                    <a href="https://hobo.tools/themes"><span class="icon">🎨</span> Themes</a>
                    <a href="https://hobo.tools/my#linked"><span class="icon">🔗</span> Linked Services</a>
                    ${u.role === 'admin' ? `<a href="https://hobo.tools/admin"><span class="icon">🛠️</span> Admin Panel</a>` : ''}
                    <div style="height:1px;background:var(--border,#333340);margin:4px -8px"></div>
                    <button id="hobo-logout-btn" class="danger"><span class="icon">🚪</span> Sign Out</button>
                </div>
            `;
            nav.appendChild(dropdown);

            // Avatar click toggles dropdown
            nav.querySelector('#hobo-avatar-btn').addEventListener('click', () => {
                dropdown.classList.toggle('open');
            });

            // Close on outside click
            document.addEventListener('click', e => {
                if (!nav.contains(e.target)) dropdown.classList.remove('open');
            });

            // Account switching
            dropdown.querySelectorAll('[data-account-id]').forEach(el => {
                el.addEventListener('click', () => {
                    const id = el.dataset.accountId;
                    document.dispatchEvent(new CustomEvent('hobo-switch-account', { detail: { accountId: id } }));
                    dropdown.classList.remove('open');
                });
            });

            dropdown.querySelector('#hobo-add-account')?.addEventListener('click', () => {
                window.location.href = `https://hobo.tools/login?add_account=1&return=${encodeURIComponent(window.location.href)}`;
            });

            dropdown.querySelector('#hobo-logout-btn')?.addEventListener('click', () => {
                dropdown.classList.remove('open');
                if (_config.onLogout) _config.onLogout();
                else {
                    document.cookie = 'hobo_token=;path=/;max-age=0';
                    localStorage.removeItem('hobo_token');
                    window.location.reload();
                }
            });
        } else {
            nav.querySelector('#hobo-login-btn')?.addEventListener('click', () => {
                if (_config.onLogin) _config.onLogin();
                else window.location.href = `https://hobo.tools/login?return=${encodeURIComponent(window.location.href)}`;
            });
        }

        // Insert into page
        document.body.prepend(nav);
        _navEl = nav;
        return nav;
    }

    const HoboNavbar = {
        init(opts = {}) {
            Object.assign(_config, opts);
            injectStyles();
            return render();
        },

        /** Update user (after account switch). */
        setUser(user) {
            _config.user = user;
            render();
        },

        setToken(token) { _config.token = token; },

        /** Get the bell mount point for HoboNotifications. */
        getBellMount() {
            return _navEl?.querySelector('#hobo-bell-mount') || null;
        },

        getElement() { return _navEl; },

        destroy() {
            _navEl?.remove();
            _navEl = null;
        },
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = HoboNavbar;
    else root.HoboNavbar = HoboNavbar;

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
