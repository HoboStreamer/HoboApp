'use strict';

// ═══════════════════════════════════════════════════════════════
// HoboImg — Domain → Context Mapping
// One Express server handles all image subdomain hostnames.
// Each hostname maps to a brand name, default tool, and SEO data.
// ═══════════════════════════════════════════════════════════════

const DOMAIN_MAP = {
    // ── Hub ──────────────────────────────────────────────────
    'img.hobo.tools': {
        toolId: 'hub', brandName: 'HoboImg', defaultOp: 'convert',
        faIcon: 'fa-images',
        seoTitle: 'HoboImg — Free Online Image Converter & Tools',
        seoDescription: 'Convert, compress, resize, and crop images online for free. Supports PNG, JPG, WebP, AVIF, HEIC, SVG, GIF, ICO, TIFF, BMP and more.',
    },

    // ── Format-specific ──────────────────────────────────────
    'png.hobo.tools': {
        toolId: 'png', brandName: 'HoboPNG', defaultOp: 'convert', defaultFormat: 'png',
        faIcon: 'fa-file-image',
        seoTitle: 'HoboPNG — Convert Images to PNG Online Free',
        seoDescription: 'Convert JPG, WebP, AVIF, HEIC, GIF, BMP, TIFF and more to PNG format online. Free, fast, no sign-up required.',
    },
    'jpg.hobo.tools': {
        toolId: 'jpg', brandName: 'HoboJPG', defaultOp: 'convert', defaultFormat: 'jpg',
        faIcon: 'fa-file-image',
        seoTitle: 'HoboJPG — Convert Images to JPG Online Free',
        seoDescription: 'Convert PNG, WebP, AVIF, HEIC, GIF, BMP, TIFF and more to JPG format online. Free, fast, no sign-up required.',
    },
    'jpeg.hobo.tools': {
        toolId: 'jpg', brandName: 'HoboJPG', defaultOp: 'convert', defaultFormat: 'jpg',
        faIcon: 'fa-file-image', alias: 'jpg.hobo.tools',
        seoTitle: 'HoboJPG — Convert Images to JPEG Online Free',
        seoDescription: 'Convert any image to JPEG format online. Free, fast, no sign-up required.',
    },
    'webp.hobo.tools': {
        toolId: 'webp', brandName: 'HoboWebP', defaultOp: 'convert', defaultFormat: 'webp',
        faIcon: 'fa-file-image',
        seoTitle: 'HoboWebP — Convert Images to WebP Online Free',
        seoDescription: 'Convert PNG, JPG, AVIF, HEIC, GIF, BMP, TIFF and more to WebP format. Smaller file sizes with great quality.',
    },
    'avif.hobo.tools': {
        toolId: 'avif', brandName: 'HoboAVIF', defaultOp: 'convert', defaultFormat: 'avif',
        faIcon: 'fa-file-image',
        seoTitle: 'HoboAVIF — Convert Images to AVIF Online Free',
        seoDescription: 'Convert images to AVIF format for superior compression. Supports PNG, JPG, WebP, HEIC, TIFF, BMP, GIF input.',
    },
    'heic.hobo.tools': {
        toolId: 'heic', brandName: 'HoboHEIC', defaultOp: 'convert', defaultFormat: 'png',
        faIcon: 'fa-file-image',
        seoTitle: 'HoboHEIC — Convert HEIC/HEIF Images Online Free',
        seoDescription: 'Convert HEIC and HEIF photos from iPhone to PNG, JPG, WebP and more. Free, fast, works in your browser.',
    },
    'heif.hobo.tools': {
        toolId: 'heic', brandName: 'HoboHEIC', defaultOp: 'convert', defaultFormat: 'png',
        faIcon: 'fa-file-image', alias: 'heic.hobo.tools',
        seoTitle: 'HoboHEIC — Convert HEIF Images Online Free',
        seoDescription: 'Convert HEIF photos to PNG, JPG, WebP and more. Free, fast, works in your browser.',
    },
    'svg.hobo.tools': {
        toolId: 'svg', brandName: 'HoboSVG', defaultOp: 'convert', defaultFormat: 'png',
        faIcon: 'fa-bezier-curve',
        seoTitle: 'HoboSVG — Convert SVG Images Online Free',
        seoDescription: 'Convert SVG to PNG, JPG, WebP. Convert bitmap images to SVG vector traces. Free online SVG converter.',
    },
    'gif.hobo.tools': {
        toolId: 'gif', brandName: 'HoboGIF', defaultOp: 'convert', defaultFormat: 'gif',
        faIcon: 'fa-film',
        seoTitle: 'HoboGIF — Convert Images to GIF Online Free',
        seoDescription: 'Convert images to and from GIF format online. Free, fast, no sign-up required.',
    },
    'ico.hobo.tools': {
        toolId: 'ico', brandName: 'HoboICO', defaultOp: 'convert', defaultFormat: 'ico',
        faIcon: 'fa-icons',
        seoTitle: 'HoboICO — Create ICO Favicons Online Free',
        seoDescription: 'Convert PNG, JPG, SVG images to ICO favicon format. Multi-size ICO generation for websites.',
    },
    'tiff.hobo.tools': {
        toolId: 'tiff', brandName: 'HoboTIFF', defaultOp: 'convert', defaultFormat: 'tiff',
        faIcon: 'fa-file-image',
        seoTitle: 'HoboTIFF — Convert Images to TIFF Online Free',
        seoDescription: 'Convert PNG, JPG, WebP and more to TIFF format. High-quality lossless conversion for print and archival.',
    },
    'bmp.hobo.tools': {
        toolId: 'bmp', brandName: 'HoboBMP', defaultOp: 'convert', defaultFormat: 'bmp',
        faIcon: 'fa-file-image',
        seoTitle: 'HoboBMP — Convert Images to BMP Online Free',
        seoDescription: 'Convert images to and from BMP bitmap format online. Free and fast.',
    },

    // ── Utility tools ────────────────────────────────────────
    'compress.hobo.tools': {
        toolId: 'compress', brandName: 'HoboCompress', defaultOp: 'compress',
        faIcon: 'fa-compress',
        seoTitle: 'HoboCompress — Compress Images Online Free',
        seoDescription: 'Reduce image file size without losing quality. Compress PNG, JPG, WebP, AVIF images online for free.',
    },
    'resize.hobo.tools': {
        toolId: 'resize', brandName: 'HoboResize', defaultOp: 'resize',
        faIcon: 'fa-up-right-and-down-left-from-center',
        seoTitle: 'HoboResize — Resize Images Online Free',
        seoDescription: 'Resize images to any dimension. Scale by pixels, percentage, or fit mode. Free online image resizer.',
    },
    'crop.hobo.tools': {
        toolId: 'crop', brandName: 'HoboCrop', defaultOp: 'crop',
        faIcon: 'fa-crop-simple',
        seoTitle: 'HoboCrop — Crop Images Online Free',
        seoDescription: 'Crop images by custom dimensions or preset aspect ratios (16:9, 4:3, 1:1). Free online image cropper.',
    },
    'convert.hobo.tools': {
        toolId: 'convert', brandName: 'HoboConvert', defaultOp: 'convert',
        faIcon: 'fa-arrows-rotate',
        seoTitle: 'HoboConvert — Convert Image Formats Online Free',
        seoDescription: 'Convert between 14+ image formats: PNG, JPG, WebP, AVIF, HEIC, SVG, GIF, ICO, TIFF, BMP and more.',
    },
    'favicon.hobo.tools': {
        toolId: 'favicon', brandName: 'HoboFavicon', defaultOp: 'convert', defaultFormat: 'ico',
        faIcon: 'fa-icons',
        seoTitle: 'HoboFavicon — Generate Favicons Online Free',
        seoDescription: 'Create multi-size favicons (ICO, PNG, SVG) from any image. Perfect favicons for your website.',
    },
};

const DEFAULT_CONTEXT = DOMAIN_MAP['img.hobo.tools'];

/**
 * Resolve hostname to subdomain context.
 * @param {string} hostname - e.g. 'png.hobo.tools' (no port)
 * @returns {Object} Domain context
 */
function resolveContext(hostname) {
    const host = String(hostname || '').split(':')[0].toLowerCase();
    return DOMAIN_MAP[host] || DEFAULT_CONTEXT;
}

/**
 * Get all registered hostnames (for nginx config / docs).
 */
function getAllHosts() {
    return Object.keys(DOMAIN_MAP);
}

module.exports = { resolveContext, getAllHosts, DOMAIN_MAP };
