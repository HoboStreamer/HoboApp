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
            .hobo-navbar-brand .flame { font-size: 18px; color: var(--accent, #c0965c); }
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
        hoboimg: 'HoboImg', hoboyt: 'HoboYT',
    };

    const SERVICE_ICONS = {
        hobostreamer: 'fa-tower-broadcast', hoboquest: 'fa-hat-wizard',
        hobotools: 'fa-screwdriver-wrench', hobomaps: 'fa-map-location-dot',
        hoboimg: 'fa-images', hoboyt: 'fa-circle-play',
    };

    // Subdomain → brand override for multi-subdomain services (HoboImg)
    const SUBDOMAIN_BRANDS = {
        'png.hobo.tools':      { name: 'HoboPNG',      icon: 'fa-file-image' },
        'jpg.hobo.tools':      { name: 'HoboJPG',      icon: 'fa-file-image' },
        'jpeg.hobo.tools':     { name: 'HoboJPG',      icon: 'fa-file-image' },
        'webp.hobo.tools':     { name: 'HoboWebP',     icon: 'fa-file-image' },
        'avif.hobo.tools':     { name: 'HoboAVIF',     icon: 'fa-file-image' },
        'heic.hobo.tools':     { name: 'HoboHEIC',     icon: 'fa-file-image' },
        'heif.hobo.tools':     { name: 'HoboHEIC',     icon: 'fa-file-image' },
        'svg.hobo.tools':      { name: 'HoboSVG',      icon: 'fa-bezier-curve' },
        'gif.hobo.tools':      { name: 'HoboGIF',      icon: 'fa-film' },
        'ico.hobo.tools':      { name: 'HoboICO',      icon: 'fa-icons' },
        'tiff.hobo.tools':     { name: 'HoboTIFF',     icon: 'fa-file-image' },
        'bmp.hobo.tools':      { name: 'HoboBMP',      icon: 'fa-file-image' },
        'compress.hobo.tools': { name: 'HoboCompress',  icon: 'fa-compress' },
        'resize.hobo.tools':   { name: 'HoboResize',    icon: 'fa-up-right-and-down-left-from-center' },
        'crop.hobo.tools':     { name: 'HoboCrop',      icon: 'fa-crop-simple' },
        'convert.hobo.tools':  { name: 'HoboConvert',   icon: 'fa-arrows-rotate' },
        'favicon.hobo.tools':  { name: 'HoboFavicon',   icon: 'fa-icons' },
        'yt.hobo.tools':       { name: 'HoboYT',        icon: 'fa-circle-play' },
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
        hoboimg: [
            { label: 'Convert', href: 'https://convert.hobo.tools' },
            { label: 'Compress', href: 'https://compress.hobo.tools' },
            { label: 'Resize', href: 'https://resize.hobo.tools' },
            { label: 'Crop', href: 'https://crop.hobo.tools' },
        ],
        hoboyt: [
            { label: 'Download', href: '/' },
        ],
    };

    function getAccounts() {
        try { return JSON.parse(localStorage.getItem('hobo_accounts') || '[]'); } catch { return []; }
    }

    function escapeAttr(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    }

    function getAvatarInitial(user) {
        const source = user?.display_name || user?.username || 'H';
        return String(source).trim().charAt(0).toUpperCase() || 'H';
    }

    function makeAvatarPlaceholder(user, size = 64) {
        const initial = getAvatarInitial(user);
        const bg = user?.profile_color || '#c0965c';
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                <rect width="100%" height="100%" rx="${Math.round(size / 2)}" fill="${bg}"/>
                <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${Math.round(size * 0.42)}" font-weight="700" fill="#ffffff">${initial}</text>
            </svg>`;
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
    }

    function avatarSrc(user, size = 64) {
        return user?.avatar_url || makeAvatarPlaceholder(user, size);
    }

    function avatarImg(user, size = 64, className = 'hobo-navbar-avatar', id = '') {
        const fallback = makeAvatarPlaceholder(user, size);
        const idAttr = id ? ` id="${escapeAttr(id)}"` : '';
        const alt = escapeAttr(user?.display_name || user?.username || 'Avatar');
        return `<img class="${escapeAttr(className)}" src="${escapeAttr(avatarSrc(user, size))}" data-fallback-src="${escapeAttr(fallback)}" alt="${alt}"${idAttr}>`;
    }

    function attachAvatarFallbacks(rootEl) {
        rootEl?.querySelectorAll('img[data-fallback-src]').forEach((img) => {
            img.addEventListener('error', () => {
                const fallback = img.dataset.fallbackSrc;
                if (fallback && img.src !== fallback) {
                    img.src = fallback;
                }
            }, { once: true });
        });
    }

    function render() {
        if (_navEl) _navEl.remove();

        const nav = document.createElement('nav');
        nav.className = 'hobo-navbar';
        const svc = _config.service;
        const links = SERVICE_LINKS[svc] || [];

        // Resolve brand name + icon: config override > subdomain lookup > service defaults
        const host = (typeof location !== 'undefined' && location.hostname) || '';
        const subBrand = SUBDOMAIN_BRANDS[host];
        const svcName = _config.brandName || (subBrand && subBrand.name) || SERVICE_NAMES[svc] || 'Hobo';
        const svcIcon = _config.brandIcon || (subBrand && subBrand.icon) || SERVICE_ICONS[svc] || 'fa-campground';

        const u = _config.user;
        const accounts = getAccounts();
        const isAnon = u && u.is_anon;

        nav.innerHTML = `
            <a class="hobo-navbar-brand" href="/">
                <span class="flame"><i class="fa-solid ${svcIcon}"></i></span>
                <div>
                    <div class="name">${svcName}</div>
                </div>
            </a>
            <div class="hobo-navbar-links">
                ${links.map(l => `<a href="${l.href}">${l.label}</a>`).join('')}
            </div>
            <div class="hobo-navbar-spacer"></div>
            <div class="hobo-navbar-right">
                <span class="hobo-network-badge" title="Connected to Hobo Network"><i class="fa-solid fa-campground"></i> Hobo Network</span>
                <div id="hobo-bell-mount"></div>
                ${u ? avatarImg(u, 64, 'hobo-navbar-avatar', 'hobo-avatar-btn') :
                    `<button class="hobo-navbar-login" id="hobo-login-btn">Sign In</button>`}
            </div>
        `;

        // Dropdown
        if (u) {
            const dropdown = document.createElement('div');
            dropdown.className = 'hobo-navbar-dropdown';
            dropdown.id = 'hobo-user-dropdown';

            const otherAccounts = accounts.filter(a => isAnon ? !a.is_anon : String(a.id) !== String(u.id));

            dropdown.innerHTML = `
                <div class="hobo-navbar-dropdown-header">
                    ${avatarImg(u, 72, '', '')}
                    <div class="info">
                        <div class="name">${u.display_name || u.username}</div>
                        <div class="email">${u.email || `@${u.username}`}</div>
                        ${isAnon ? `<div class="anon-tag">Anonymous #${u.anon_number || '?'}</div>` : ''}
                    </div>
                </div>
                <div class="hobo-navbar-dropdown-accounts">
                    ${otherAccounts.map(a => `
                        <div class="account-item" data-account-id="${a.id}">
                            ${avatarImg(a, 48, '', '')}
                            <span>${a.display_name || a.username}${a.is_anon ? ' (anon)' : ''}</span>
                        </div>
                    `).join('')}
                    <div class="account-item" data-account-id="anon" style="${isAnon ? 'display:none' : ''}">
                        <span style="width:24px;text-align:center"><i class="fa-solid fa-user-secret"></i></span>
                        <span>Switch to Anonymous</span>
                    </div>
                    <div class="add-account" id="hobo-add-account">
                        <span style="width:24px;text-align:center"><i class="fa-solid fa-plus"></i></span>
                        <span>Add another account</span>
                    </div>
                </div>
                <div class="hobo-navbar-dropdown-menu">
                    <a href="https://my.hobo.tools"><span class="icon"><i class="fa-solid fa-user"></i></span> My Account</a>
                    <a href="https://my.hobo.tools#notifications"><span class="icon"><i class="fa-solid fa-bell"></i></span> Notification Settings</a>
                    <a href="https://my.hobo.tools/themes"><span class="icon"><i class="fa-solid fa-palette"></i></span> Themes</a>
                    <a href="https://my.hobo.tools#linked"><span class="icon"><i class="fa-solid fa-link"></i></span> Linked Services</a>
                    ${u.role === 'admin' ? `<a href="https://hobo.tools/admin"><span class="icon"><i class="fa-solid fa-screwdriver-wrench"></i></span> Admin Panel</a>` : ''}
                    <div style="height:1px;background:var(--border,#333340);margin:4px -8px"></div>
                    <button id="hobo-logout-btn" class="danger"><span class="icon"><i class="fa-solid fa-right-from-bracket"></i></span> Sign Out</button>
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
                    document.cookie = 'hobo_token=;path=/;max-age=0;domain=.hobo.tools';
                    localStorage.removeItem('hobo_token');
                    localStorage.removeItem('hobo_anon_token');
                    localStorage.removeItem('hobo_active_account');
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
        attachAvatarFallbacks(nav);
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
