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
                transition: background .15s; text-decoration: none; display: inline-flex; align-items: center;
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
                text-decoration: none;
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
        hobofood: 'HoboFood', hoboimg: 'HoboImg', hoboyt: 'HoboYT',
        hoboaudio: 'HoboAudio', hobotext: 'HoboText', hobologo: 'HoboLogo',
        hobodocs: 'HoboDocs',
        hobonet: 'HoboNet',
        hobodev: 'HoboDev',
    };

    const SERVICE_ICONS = {
        hobostreamer: 'fa-tower-broadcast', hoboquest: 'fa-hat-wizard',
        hobotools: 'fa-screwdriver-wrench', hobomaps: 'fa-map-location-dot',
        hobofood: 'fa-utensils', hoboimg: 'fa-images', hoboyt: 'fa-circle-play',
        hoboaudio: 'fa-headphones', hobotext: 'fa-pen-fancy', hobologo: 'fa-wand-magic-sparkles',
        hobodocs: 'fa-file-pdf',
        hobonet: 'fa-network-wired',
        hobodev: 'fa-code',
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
        'maps.hobo.tools':     { name: 'HoboMaps',      icon: 'fa-map-location-dot' },
        'food.hobo.tools':     { name: 'HoboFood',      icon: 'fa-utensils' },
        // Audio tool subdomains
        'audio.hobo.tools':    { name: 'HoboAudio',     icon: 'fa-headphones' },
        'mp3.hobo.tools':      { name: 'HoboMP3',       icon: 'fa-file-audio' },
        'wav.hobo.tools':      { name: 'HoboWAV',       icon: 'fa-file-audio' },
        'flac.hobo.tools':     { name: 'HoboFLAC',      icon: 'fa-file-audio' },
        'ogg.hobo.tools':      { name: 'HoboOGG',       icon: 'fa-file-audio' },
        'm4a.hobo.tools':      { name: 'HoboM4A',       icon: 'fa-file-audio' },
        'aac.hobo.tools':      { name: 'HoboAAC',       icon: 'fa-file-audio' },
        'opus.hobo.tools':     { name: 'HoboOPUS',      icon: 'fa-file-audio' },
        'wma.hobo.tools':      { name: 'HoboWMA',       icon: 'fa-file-audio' },
        'aiff.hobo.tools':     { name: 'HoboAIFF',      icon: 'fa-file-audio' },
        'ac3.hobo.tools':      { name: 'HoboAC3',       icon: 'fa-file-audio' },
        'trim.hobo.tools':     { name: 'HoboTrim',      icon: 'fa-scissors' },
        'pitch.hobo.tools':    { name: 'HoboPitch',     icon: 'fa-wave-square' },
        'speed.hobo.tools':    { name: 'HoboSpeed',     icon: 'fa-gauge-high' },
        'normalize.hobo.tools':{ name: 'HoboNormalize', icon: 'fa-sliders' },
        'fade.hobo.tools':     { name: 'HoboFade',      icon: 'fa-volume-low' },
        'bass.hobo.tools':     { name: 'HoboBass',      icon: 'fa-volume-high' },
        'equalizer.hobo.tools':{ name: 'HoboEQ',        icon: 'fa-bars-staggered' },
        'echo.hobo.tools':     { name: 'HoboEcho',      icon: 'fa-tower-broadcast' },
        'reverb.hobo.tools':   { name: 'HoboReverb',    icon: 'fa-church' },
        'voice.hobo.tools':    { name: 'HoboVoiceFX',   icon: 'fa-user-astronaut' },
        'extract.hobo.tools':  { name: 'HoboExtract',   icon: 'fa-music' },
        'ringtone.hobo.tools': { name: 'HoboRingtone',  icon: 'fa-bell' },
        // Text tool subdomains
        'text.hobo.tools':       { name: 'HoboText',       icon: 'fa-pen-fancy' },
        'type.hobo.tools':       { name: 'HoboText',       icon: 'fa-pen-fancy' },
        'fonts.hobo.tools':      { name: 'HoboFonts',      icon: 'fa-font' },
        'fancy.hobo.tools':      { name: 'HoboFancy',      icon: 'fa-wand-sparkles' },
        'zalgo.hobo.tools':      { name: 'HoboZalgo',      icon: 'fa-skull' },
        'ascii.hobo.tools':      { name: 'HoboASCII',      icon: 'fa-terminal' },
        'symbols.hobo.tools':    { name: 'HoboSymbols',    icon: 'fa-icons' },
        'unicode.hobo.tools':    { name: 'HoboUnicode',    icon: 'fa-magnifying-glass' },
        'bubble.hobo.tools':     { name: 'HoboBubble',     icon: 'fa-circle' },
        'glitch.hobo.tools':     { name: 'HoboGlitch',     icon: 'fa-bug' },
        'smallcaps.hobo.tools':  { name: 'HoboSmallCaps',  icon: 'fa-text-height' },
        'cursive.hobo.tools':    { name: 'HoboCursive',    icon: 'fa-pen-nib' },
        'gothic.hobo.tools':     { name: 'HoboGothic',     icon: 'fa-book-skull' },
        'wide.hobo.tools':       { name: 'HoboWide',       icon: 'fa-arrows-left-right' },
        'monospaced.hobo.tools': { name: 'HoboMono',       icon: 'fa-code' },
        'braille.hobo.tools':    { name: 'HoboBraille',    icon: 'fa-braille' },
        'morse.hobo.tools':      { name: 'HoboMorse',      icon: 'fa-tower-broadcast' },
        'binary.hobo.tools':     { name: 'HoboBinary',     icon: 'fa-microchip' },
        'case.hobo.tools':       { name: 'HoboCase',       icon: 'fa-text-height' },
        'caps.hobo.tools':       { name: 'HoboCaps',       icon: 'fa-text-height' },
        'titlecase.hobo.tools':  { name: 'HoboTitleCase',  icon: 'fa-heading' },
        'reverse.hobo.tools':    { name: 'HoboReverse',    icon: 'fa-right-left' },
        'clean.hobo.tools':      { name: 'HoboClean',      icon: 'fa-broom' },
        'strip.hobo.tools':      { name: 'HoboStrip',      icon: 'fa-broom' },
        'count.hobo.tools':      { name: 'HoboCount',      icon: 'fa-calculator' },
        'lines.hobo.tools':      { name: 'HoboLines',      icon: 'fa-list-ol' },
        'sort.hobo.tools':       { name: 'HoboSort',       icon: 'fa-arrow-down-a-z' },
        'dedupe.hobo.tools':     { name: 'HoboDedupe',     icon: 'fa-filter' },
        'slug.hobo.tools':       { name: 'HoboSlug',       icon: 'fa-link' },
        'compare.hobo.tools':    { name: 'HoboCompare',    icon: 'fa-code-compare' },
        'diff.hobo.tools':       { name: 'HoboDiff',       icon: 'fa-code-compare' },
        'markdown.hobo.tools':   { name: 'HoboMarkdown',   icon: 'fa-file-lines' },
        'json.hobo.tools':       { name: 'HoboJSON',       icon: 'fa-brackets-curly' },
        'escape.hobo.tools':     { name: 'HoboEscape',     icon: 'fa-shield-halved' },
        'bio.hobo.tools':        { name: 'HoboBio',        icon: 'fa-id-card' },
        'nickname.hobo.tools':   { name: 'HoboNickname',   icon: 'fa-signature' },
        'username.hobo.tools':   { name: 'HoboUsername',   icon: 'fa-at' },
        'gamertag.hobo.tools':   { name: 'HoboGamertag',   icon: 'fa-gamepad' },
        'kaomoji.hobo.tools':    { name: 'HoboKaomoji',    icon: 'fa-face-smile' },
        'emojis.hobo.tools':     { name: 'HoboEmojis',     icon: 'fa-face-grin' },
        'copypaste.hobo.tools':  { name: 'HoboCopyPaste',  icon: 'fa-paste' },
        'banner.hobo.tools':     { name: 'HoboBanner',     icon: 'fa-rectangle-ad' },
        'textart.hobo.tools':    { name: 'HoboTextArt',    icon: 'fa-border-all' },
        'figlet.hobo.tools':     { name: 'HoboFiglet',     icon: 'fa-terminal' },
        // Logo / design subdomains
        'logo.hobo.tools':       { name: 'HoboLogo',       icon: 'fa-wand-magic-sparkles' },
        'title.hobo.tools':      { name: 'HoboTitle',      icon: 'fa-heading' },
        'wordmark.hobo.tools':   { name: 'HoboWordmark',   icon: 'fa-font' },
        'textlogo.hobo.tools':   { name: 'HoboTextLogo',   icon: 'fa-font' },
        'transparent.hobo.tools':{ name: 'HoboTransparent', icon: 'fa-eye-slash' },
        'badge.hobo.tools':      { name: 'HoboBadge',      icon: 'fa-certificate' },
        'sticker.hobo.tools':    { name: 'HoboSticker',    icon: 'fa-note-sticky' },
        'thumbnail.hobo.tools':  { name: 'HoboThumbnail',  icon: 'fa-photo-film' },
        'cover.hobo.tools':      { name: 'HoboCover',      icon: 'fa-image' },
        'channelart.hobo.tools': { name: 'HoboChannelArt', icon: 'fa-panorama' },
        'watermark.hobo.tools':  { name: 'HoboWatermark',  icon: 'fa-droplet' },
        'neon.hobo.tools':       { name: 'HoboNeon',       icon: 'fa-lightbulb' },
        // Document / PDF subdomains
        'docs.hobo.tools':       { name: 'HoboDocs',      icon: 'fa-file-pdf' },
        'pdf.hobo.tools':        { name: 'HoboPDF',       icon: 'fa-file-pdf' },
        'mergepdf.hobo.tools':   { name: 'MergePDF',      icon: 'fa-object-group' },
        'splitpdf.hobo.tools':   { name: 'SplitPDF',      icon: 'fa-scissors' },
        'compresspdf.hobo.tools':{ name: 'CompressPDF',   icon: 'fa-compress' },
        'rotatepdf.hobo.tools':  { name: 'RotatePDF',     icon: 'fa-rotate' },
        'reorderpdf.hobo.tools': { name: 'ReorderPDF',    icon: 'fa-sort' },
        'watermarkpdf.hobo.tools':{ name: 'WatermarkPDF', icon: 'fa-stamp' },
        'protectpdf.hobo.tools': { name: 'ProtectPDF',    icon: 'fa-lock' },
        'unlockpdf.hobo.tools':  { name: 'UnlockPDF',     icon: 'fa-lock-open' },
        'image2pdf.hobo.tools':  { name: 'Image2PDF',     icon: 'fa-file-image' },
        'jpg2pdf.hobo.tools':    { name: 'JPG2PDF',       icon: 'fa-file-image' },
        'png2pdf.hobo.tools':    { name: 'PNG2PDF',       icon: 'fa-file-image' },
        'pdf2jpg.hobo.tools':    { name: 'PDF2JPG',       icon: 'fa-image' },
        'pdf2png.hobo.tools':    { name: 'PDF2PNG',       icon: 'fa-image' },
        // Network tool subdomains
        'net.hobo.tools':        { name: 'HoboNet',       icon: 'fa-network-wired' },
        'lookup.hobo.tools':     { name: 'HoboLookup',    icon: 'fa-magnifying-glass' },
        'myip.hobo.tools':       { name: 'HoboMyIP',      icon: 'fa-location-crosshairs' },
        'ip.hobo.tools':         { name: 'HoboIP',        icon: 'fa-at' },
        'geoip.hobo.tools':      { name: 'HoboGeoIP',     icon: 'fa-earth-americas' },
        'hostname.hobo.tools':   { name: 'HoboHostname',  icon: 'fa-server' },
        'isp.hobo.tools':        { name: 'HoboISP',       icon: 'fa-building' },
        'asn.hobo.tools':        { name: 'HoboASN',       icon: 'fa-diagram-project' },
        'ipv4.hobo.tools':       { name: 'HoboIPv4',      icon: 'fa-hashtag' },
        'ipv6.hobo.tools':       { name: 'HoboIPv6',      icon: 'fa-code' },
        'rdns.hobo.tools':       { name: 'HoboReverseDNS',icon: 'fa-rotate-left' },
        'whois.hobo.tools':      { name: 'HoboWhois',     icon: 'fa-address-book' },
        'rdap.hobo.tools':       { name: 'HoboRDAP',      icon: 'fa-id-card' },
        'dns.hobo.tools':        { name: 'HoboDNS',       icon: 'fa-sitemap' },
        'dig.hobo.tools':        { name: 'HoboDig',       icon: 'fa-terminal' },
        'nslookup.hobo.tools':   { name: 'HoboNSLookup',  icon: 'fa-magnifying-glass-arrow-right' },
        'dnspropagation.hobo.tools': { name: 'HoboDNSPropagation', icon: 'fa-globe' },
        'mx.hobo.tools':         { name: 'HoboMX',        icon: 'fa-envelope' },
        'txt.hobo.tools':        { name: 'HoboTXT',       icon: 'fa-file-lines' },
        'ns.hobo.tools':         { name: 'HoboNS',        icon: 'fa-server' },
        'spf.hobo.tools':        { name: 'HoboSPF',       icon: 'fa-shield-halved' },
        'dkim.hobo.tools':       { name: 'HoboDKIM',      icon: 'fa-key' },
        'dmarc.hobo.tools':      { name: 'HoboDMARC',     icon: 'fa-user-shield' },
        'ping.hobo.tools':       { name: 'HoboPing',      icon: 'fa-satellite-dish' },
        'traceroute.hobo.tools': { name: 'HoboTraceroute', icon: 'fa-route' },
        'mtr.hobo.tools':        { name: 'HoboMTR',       icon: 'fa-chart-line' },
        'port.hobo.tools':       { name: 'HoboPortCheck', icon: 'fa-door-open' },
        'headers.hobo.tools':    { name: 'HoboHeaders',   icon: 'fa-list' },
        'redirects.hobo.tools':  { name: 'HoboRedirects', icon: 'fa-share' },
        'ssl.hobo.tools':        { name: 'HoboSSL',       icon: 'fa-lock' },
        'curl.hobo.tools':       { name: 'HoboCurl',      icon: 'fa-download' },
        'httpstatus.hobo.tools': { name: 'HoboHTTPStatus', icon: 'fa-circle-check' },
        'latency.hobo.tools':    { name: 'HoboLatency',   icon: 'fa-gauge-high' },
        // HoboDev subdomains
        'dev.hobo.tools':        { name: 'HoboDev',       icon: 'fa-code' },
        'code.hobo.tools':       { name: 'HoboDev',       icon: 'fa-code' },
        'json.hobo.tools':       { name: 'HoboJSON',      icon: 'fa-code' },
        'yaml.hobo.tools':       { name: 'HoboYAML',      icon: 'fa-file-code' },
        'xml.hobo.tools':        { name: 'HoboXML',       icon: 'fa-file-code' },
        'csv.hobo.tools':        { name: 'HoboCSV',       icon: 'fa-table' },
        'sql.hobo.tools':        { name: 'HoboSQL',       icon: 'fa-database' },
        'markdown.hobo.tools':   { name: 'HoboMarkdown',  icon: 'fa-file-lines' },
        'html.hobo.tools':       { name: 'HoboHTML',      icon: 'fa-file-code' },
        'base64.hobo.tools':     { name: 'HoboBase64',    icon: 'fa-lock' },
        'url.hobo.tools':        { name: 'HoboURL',       icon: 'fa-link' },
        'jwt.hobo.tools':        { name: 'HoboJWT',       icon: 'fa-key' },
        'uuid.hobo.tools':       { name: 'HoboUUID',      icon: 'fa-fingerprint' },
        'hash.hobo.tools':       { name: 'HoboHash',      icon: 'fa-hashtag' },
        'hex.hobo.tools':        { name: 'HoboHex',       icon: 'fa-barcode' },
        'escape.hobo.tools':     { name: 'HoboEscape',    icon: 'fa-shield-halved' },
        'timestamp.hobo.tools':  { name: 'HoboTimestamp', icon: 'fa-clock' },
        'cron.hobo.tools':       { name: 'HoboCron',      icon: 'fa-calendar-check' },
        'beautify.hobo.tools':   { name: 'HoboBeautify',  icon: 'fa-wand-magic-sparkles' },
        'minify.hobo.tools':     { name: 'HoboMinify',    icon: 'fa-compress' },
        'diff.hobo.tools':       { name: 'HoboDiff',      icon: 'fa-code-compare' },
        'regex.hobo.tools':      { name: 'HoboRegex',     icon: 'fa-magnifying-glass' },
        'slug.hobo.tools':       { name: 'HoboSlug',      icon: 'fa-link' },
        'lorem.hobo.tools':      { name: 'HoboLorem',     icon: 'fa-paragraph' },
        'curl.hobo.tools':       { name: 'HoboCurl',      icon: 'fa-terminal' },
        'webhook.hobo.tools':    { name: 'HoboWebhook',   icon: 'fa-satellite-dish' },
        'color.hobo.tools':      { name: 'HoboColor',     icon: 'fa-palette' },
        'opengraph.hobo.tools':  { name: 'HoboOpenGraph', icon: 'fa-share-nodes' },
        // HoboDev aliases
        'build.hobo.tools':      { name: 'HoboDev',       icon: 'fa-code' },
        'debug.hobo.tools':      { name: 'HoboDev',       icon: 'fa-code' },
        'compare.hobo.tools':    { name: 'HoboDiff',      icon: 'fa-code-compare' },
        'format.hobo.tools':     { name: 'HoboBeautify',  icon: 'fa-wand-magic-sparkles' },
        'prettier.hobo.tools':   { name: 'HoboBeautify',  icon: 'fa-wand-magic-sparkles' },
        'md.hobo.tools':         { name: 'HoboMarkdown',  icon: 'fa-file-lines' },
        'unix.hobo.tools':       { name: 'HoboTimestamp', icon: 'fa-clock' },
        'epoch.hobo.tools':      { name: 'HoboTimestamp', icon: 'fa-clock' },
        'b64.hobo.tools':        { name: 'HoboBase64',    icon: 'fa-lock' },
        'guid.hobo.tools':       { name: 'HoboUUID',      icon: 'fa-fingerprint' },
        'sha256.hobo.tools':     { name: 'HoboHash',      icon: 'fa-hashtag' },
        'entities.hobo.tools':   { name: 'HoboEscape',    icon: 'fa-shield-halved' },
        'http.hobo.tools':       { name: 'HoboCurl',      icon: 'fa-terminal' },
        'og.hobo.tools':         { name: 'HoboOpenGraph', icon: 'fa-share-nodes' },
        'colors.hobo.tools':     { name: 'HoboColor',     icon: 'fa-palette' },
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
        hobofood: [
            { label: 'Food Banks', href: '/' },
            { label: 'Meal Plan', href: '/#meal-plan' },
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
        hoboaudio: [
            { label: 'Convert', href: 'https://audio.hobo.tools' },
            { label: 'Trim', href: 'https://trim.hobo.tools' },
            { label: 'Pitch', href: 'https://pitch.hobo.tools' },
            { label: 'Reverb', href: 'https://reverb.hobo.tools' },
        ],
        hobotext: [
            { label: 'Fancy', href: 'https://fancy.hobo.tools' },
            { label: 'Zalgo', href: 'https://zalgo.hobo.tools' },
            { label: 'ASCII', href: 'https://ascii.hobo.tools' },
            { label: 'Symbols', href: 'https://symbols.hobo.tools' },
        ],
        hobologo: [
            { label: 'Title', href: 'https://title.hobo.tools' },
            { label: 'Wordmark', href: 'https://wordmark.hobo.tools' },
            { label: 'Badge', href: 'https://badge.hobo.tools' },
            { label: 'Thumbnail', href: 'https://thumbnail.hobo.tools' },
        ],
        hobodocs: [
            { label: 'Merge', href: 'https://mergepdf.hobo.tools' },
            { label: 'Split', href: 'https://splitpdf.hobo.tools' },
            { label: 'Compress', href: 'https://compresspdf.hobo.tools' },
            { label: 'Images→PDF', href: 'https://image2pdf.hobo.tools' },
        ],
        hobonet: [
            { label: 'Lookup', href: 'https://lookup.hobo.tools' },
            { label: 'My IP', href: 'https://myip.hobo.tools' },
            { label: 'DNS', href: 'https://dns.hobo.tools' },
            { label: 'Ping', href: 'https://ping.hobo.tools' },
            { label: 'SSL', href: 'https://ssl.hobo.tools' },
        ],
        hobodev: [
            { label: 'JSON', href: 'https://json.hobo.tools' },
            { label: 'Base64', href: 'https://base64.hobo.tools' },
            { label: 'JWT', href: 'https://jwt.hobo.tools' },
            { label: 'Regex', href: 'https://regex.hobo.tools' },
            { label: 'Diff', href: 'https://diff.hobo.tools' },
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
        // Exact match first (e.g., hostname.hobo.tools), then fallback to service name
        let subBrand = SUBDOMAIN_BRANDS[host];
        if (!subBrand && host && host.includes('.hobo.tools')) {
            // Try matching against service names
            const parts = host.split('.');
            const potential = parts[0]; // e.g., 'json' from 'json.hobo.tools'
            subBrand = SUBDOMAIN_BRANDS[`${potential}.hobo.tools`];
        }
        const svcName = _config.brandName || (subBrand && subBrand.name) || SERVICE_NAMES[svc] || 'Hobo';
        const svcIcon = _config.brandIcon || (subBrand && subBrand.icon) || SERVICE_ICONS[svc] || 'fa-campground';

        // my.hobo.tools home should go to hobo.tools root, not back to itself
        const brandHref = (host === 'my.hobo.tools') ? 'https://hobo.tools/' : '/';

        const u = _config.user;
        const accounts = getAccounts();
        const isAnon = u && u.is_anon;
        const loginHref = `https://hobo.tools/login?return=${encodeURIComponent(window.location.href)}`;
        const addAccountHref = `https://hobo.tools/login?add_account=1&return=${encodeURIComponent(window.location.href)}`;

        nav.innerHTML = `
            <a class="hobo-navbar-brand" href="${brandHref}">
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
                <a class="hobo-network-badge" href="https://hobo.tools" title="Connected to Hobo Network"><i class="fa-solid fa-campground"></i> Hobo Network</a>
                <div id="hobo-bell-mount"></div>
                ${u ? avatarImg(u, 64, 'hobo-navbar-avatar', 'hobo-avatar-btn') :
                    `<a class="hobo-navbar-login" id="hobo-login-btn" href="${escapeAttr(loginHref)}">Sign In</a>`}
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
                    <a class="add-account" id="hobo-add-account" href="${escapeAttr(addAccountHref)}">
                        <span style="width:24px;text-align:center"><i class="fa-solid fa-plus"></i></span>
                        <span>Add another account</span>
                    </a>
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
            nav.querySelector('#hobo-login-btn')?.addEventListener('click', (event) => {
                if (!_config.onLogin) return;
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                _config.onLogin();
            });
        }

        // Insert into page — use navbar-mount placeholder if available, otherwise prepend to body
        const mount = document.getElementById('navbar-mount');
        if (mount) {
            mount.appendChild(nav);
        } else {
            document.body.prepend(nav);
        }
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
