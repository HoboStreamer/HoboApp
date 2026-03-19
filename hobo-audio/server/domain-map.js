'use strict';

// ═══════════════════════════════════════════════════════════════
// HoboAudio — Domain → Context Mapping
// One Express server handles all audio subdomain hostnames.
// Each hostname maps to a brand name, default tool, and SEO data.
// ═══════════════════════════════════════════════════════════════

const DOMAIN_MAP = {
    // ── Hub ──────────────────────────────────────────────────
    'audio.hobo.tools': {
        toolId: 'hub', brandName: 'HoboAudio', defaultOp: 'convert',
        faIcon: 'fa-headphones',
        seoTitle: 'HoboAudio — Free Online Audio Converter & Tools',
        seoDescription: 'Convert, trim, merge, pitch-shift, speed-change, and process audio files online for free. Supports MP3, WAV, FLAC, OGG, M4A, OPUS, AAC, WMA, AIFF, and more.',
    },

    // ── Format-specific converters ───────────────────────────
    'mp3.hobo.tools': {
        toolId: 'mp3', brandName: 'HoboMP3', defaultOp: 'convert', defaultFormat: 'mp3',
        faIcon: 'fa-file-audio',
        seoTitle: 'HoboMP3 — Convert Audio to MP3 Online Free',
        seoDescription: 'Convert WAV, FLAC, OGG, M4A, AAC, WMA, AIFF and more to MP3 format online. Free, fast, no sign-up required.',
    },
    'wav.hobo.tools': {
        toolId: 'wav', brandName: 'HoboWAV', defaultOp: 'convert', defaultFormat: 'wav',
        faIcon: 'fa-file-audio',
        seoTitle: 'HoboWAV — Convert Audio to WAV Online Free',
        seoDescription: 'Convert MP3, FLAC, OGG, M4A, AAC and more to lossless WAV format online. Free, fast, no sign-up required.',
    },
    'flac.hobo.tools': {
        toolId: 'flac', brandName: 'HoboFLAC', defaultOp: 'convert', defaultFormat: 'flac',
        faIcon: 'fa-file-audio',
        seoTitle: 'HoboFLAC — Convert Audio to FLAC Online Free',
        seoDescription: 'Convert MP3, WAV, OGG, M4A, AAC and more to lossless FLAC format online. Free, fast, no sign-up required.',
    },
    'ogg.hobo.tools': {
        toolId: 'ogg', brandName: 'HoboOGG', defaultOp: 'convert', defaultFormat: 'ogg',
        faIcon: 'fa-file-audio',
        seoTitle: 'HoboOGG — Convert Audio to OGG Vorbis Online Free',
        seoDescription: 'Convert MP3, WAV, FLAC, M4A, AAC and more to OGG Vorbis format online. Free, open-source codec.',
    },
    'm4a.hobo.tools': {
        toolId: 'm4a', brandName: 'HoboM4A', defaultOp: 'convert', defaultFormat: 'm4a',
        faIcon: 'fa-file-audio',
        seoTitle: 'HoboM4A — Convert Audio to M4A (AAC) Online Free',
        seoDescription: 'Convert MP3, WAV, FLAC, OGG, WMA and more to M4A/AAC format online. Great quality at small file sizes.',
    },
    'opus.hobo.tools': {
        toolId: 'opus', brandName: 'HoboOpus', defaultOp: 'convert', defaultFormat: 'opus',
        faIcon: 'fa-file-audio',
        seoTitle: 'HoboOpus — Convert Audio to Opus Online Free',
        seoDescription: 'Convert audio files to Opus format — the modern open-source codec. Best quality-to-size ratio for voice and music.',
    },
    'aac.hobo.tools': {
        toolId: 'aac', brandName: 'HoboAAC', defaultOp: 'convert', defaultFormat: 'aac',
        faIcon: 'fa-file-audio',
        seoTitle: 'HoboAAC — Convert Audio to AAC Online Free',
        seoDescription: 'Convert MP3, WAV, FLAC, OGG and more to AAC format online. Free, fast, great for mobile devices.',
    },
    'wma.hobo.tools': {
        toolId: 'wma', brandName: 'HoboWMA', defaultOp: 'convert', defaultFormat: 'wma',
        faIcon: 'fa-file-audio',
        seoTitle: 'HoboWMA — Convert Audio to WMA Online Free',
        seoDescription: 'Convert MP3, WAV, FLAC and more to Windows Media Audio format. Free online WMA converter.',
    },
    'aiff.hobo.tools': {
        toolId: 'aiff', brandName: 'HoboAIFF', defaultOp: 'convert', defaultFormat: 'aiff',
        faIcon: 'fa-file-audio',
        seoTitle: 'HoboAIFF — Convert Audio to AIFF Online Free',
        seoDescription: 'Convert audio files to Apple AIFF format. Lossless quality for music production and archiving.',
    },
    'ac3.hobo.tools': {
        toolId: 'ac3', brandName: 'HoboAC3', defaultOp: 'convert', defaultFormat: 'ac3',
        faIcon: 'fa-file-audio',
        seoTitle: 'HoboAC3 — Convert Audio to AC3 (Dolby Digital) Online Free',
        seoDescription: 'Convert audio files to AC3 Dolby Digital format. Perfect for surround sound and home theater.',
    },

    // ── Audio Processing Tools ───────────────────────────────
    'trim.hobo.tools': {
        toolId: 'trim', brandName: 'HoboTrim', defaultOp: 'trim',
        faIcon: 'fa-scissors',
        seoTitle: 'HoboTrim — Trim & Cut Audio Online Free',
        seoDescription: 'Cut and trim audio files to any length. Set start and end times with precision. Free online audio trimmer.',
    },
    'merge.hobo.tools': {
        toolId: 'merge', brandName: 'HoboMerge', defaultOp: 'merge',
        faIcon: 'fa-object-group',
        seoTitle: 'HoboMerge — Merge & Join Audio Files Online Free',
        seoDescription: 'Combine multiple audio files into one. Merge MP3, WAV, FLAC and more. Free online audio joiner.',
    },
    'pitch.hobo.tools': {
        toolId: 'pitch', brandName: 'HoboPitch', defaultOp: 'pitch',
        faIcon: 'fa-wave-square',
        seoTitle: 'HoboPitch — Change Audio Pitch Online Free',
        seoDescription: 'Shift audio pitch up or down by semitones without changing speed. Free online pitch changer for music and voice.',
    },
    'speed.hobo.tools': {
        toolId: 'speed', brandName: 'HoboSpeed', defaultOp: 'speed',
        faIcon: 'fa-gauge-high',
        seoTitle: 'HoboSpeed — Change Audio Speed Online Free',
        seoDescription: 'Speed up or slow down audio playback. Adjust tempo without affecting pitch. Free online speed changer.',
    },
    'reverse.hobo.tools': {
        toolId: 'reverse', brandName: 'HoboReverse', defaultOp: 'reverse',
        faIcon: 'fa-backward',
        seoTitle: 'HoboReverse — Reverse Audio Online Free',
        seoDescription: 'Reverse any audio file instantly. Play it backwards — great for creative effects and fun. Free online tool.',
    },
    'normalize.hobo.tools': {
        toolId: 'normalize', brandName: 'HoboNormalize', defaultOp: 'normalize',
        faIcon: 'fa-sliders',
        seoTitle: 'HoboNormalize — Normalize Audio Volume Online Free',
        seoDescription: 'Normalize audio loudness to a consistent level. Fix quiet or too-loud recordings. Free online audio normalizer.',
    },
    'fade.hobo.tools': {
        toolId: 'fade', brandName: 'HoboFade', defaultOp: 'fade',
        faIcon: 'fa-volume-low',
        seoTitle: 'HoboFade — Add Fade In/Out to Audio Online Free',
        seoDescription: 'Add smooth fade-in and fade-out effects to audio files. Professional transitions, free online tool.',
    },
    'loop.hobo.tools': {
        toolId: 'loop', brandName: 'HoboLoop', defaultOp: 'loop',
        faIcon: 'fa-repeat',
        seoTitle: 'HoboLoop — Loop Audio Online Free',
        seoDescription: 'Loop audio files a set number of times. Create repeated versions of any sound. Free online audio looper.',
    },
    'bass.hobo.tools': {
        toolId: 'bass', brandName: 'HoboBass', defaultOp: 'bass',
        faIcon: 'fa-volume-high',
        seoTitle: 'HoboBass — Boost Bass Online Free',
        seoDescription: 'Boost or reduce bass frequencies in audio files. Enhance that low end. Free online bass booster.',
    },
    'equalizer.hobo.tools': {
        toolId: 'equalizer', brandName: 'HoboEQ', defaultOp: 'equalizer',
        faIcon: 'fa-bars-staggered',
        seoTitle: 'HoboEQ — Online Audio Equalizer Free',
        seoDescription: 'Apply equalizer presets to audio files. Boost bass, treble, vocals and more. Free online EQ tool.',
    },
    'vocal.hobo.tools': {
        toolId: 'vocal', brandName: 'HoboVocal', defaultOp: 'vocal',
        faIcon: 'fa-microphone',
        seoTitle: 'HoboVocal — Remove/Isolate Vocals Online Free',
        seoDescription: 'Remove or isolate vocals from audio tracks. Create karaoke versions or extract vocals. Free online tool.',
    },
    'karaoke.hobo.tools': {
        toolId: 'vocal', brandName: 'HoboKaraoke', defaultOp: 'vocal',
        faIcon: 'fa-microphone-lines', alias: 'vocal.hobo.tools',
        seoTitle: 'HoboKaraoke — Make Karaoke Tracks Online Free',
        seoDescription: 'Remove vocals from any song to create karaoke backing tracks. Free online karaoke maker.',
    },

    // ── Extraction / Analysis ────────────────────────────────
    'extract.hobo.tools': {
        toolId: 'extract', brandName: 'HoboExtract', defaultOp: 'extract',
        faIcon: 'fa-music',
        seoTitle: 'HoboExtract — Extract Audio from Video Online Free',
        seoDescription: 'Extract and rip audio tracks from video files. MP4, MKV, AVI, WebM to MP3/WAV/FLAC. Free online extractor.',
    },
    'waveform.hobo.tools': {
        toolId: 'waveform', brandName: 'HoboWaveform', defaultOp: 'waveform',
        faIcon: 'fa-chart-line',
        seoTitle: 'HoboWaveform — Generate Audio Waveform Images Online Free',
        seoDescription: 'Generate beautiful waveform visualizations from audio files. PNG or SVG output. Free online waveform generator.',
    },

    // ── Specialized / Fun ────────────────────────────────────
    'ringtone.hobo.tools': {
        toolId: 'ringtone', brandName: 'HoboRingtone', defaultOp: 'ringtone',
        faIcon: 'fa-bell',
        seoTitle: 'HoboRingtone — Create Ringtones Online Free',
        seoDescription: 'Create custom ringtones from any audio file. Trim, fade, and export as M4R (iPhone) or MP3 (Android). Free tool.',
    },
    'podcast.hobo.tools': {
        toolId: 'podcast', brandName: 'HoboPodcast', defaultOp: 'podcast',
        faIcon: 'fa-podcast',
        seoTitle: 'HoboPodcast — Optimize Audio for Podcasts Online Free',
        seoDescription: 'Optimize audio for podcast publishing. Normalize loudness, compress dynamics, convert to podcast-ready format.',
    },
    'voice.hobo.tools': {
        toolId: 'voice', brandName: 'HoboVoice', defaultOp: 'voice',
        faIcon: 'fa-user-astronaut',
        seoTitle: 'HoboVoice — Voice Effects & Changer Online Free',
        seoDescription: 'Apply fun voice effects — chipmunk, deep, robot, echo, and more. Free online voice changer.',
    },
    'noise.hobo.tools': {
        toolId: 'noise', brandName: 'HoboNoise', defaultOp: 'noise',
        faIcon: 'fa-broom',
        seoTitle: 'HoboNoise — Reduce Background Noise Online Free',
        seoDescription: 'Remove background noise from audio recordings. Clean up interviews, podcasts, and voice memos. Free tool.',
    },
    'bitcrusher.hobo.tools': {
        toolId: 'bitcrusher', brandName: 'HoboBitcrusher', defaultOp: 'bitcrusher',
        faIcon: 'fa-microchip',
        seoTitle: 'HoboBitcrusher — Lo-Fi Bitcrusher Audio Effect Online Free',
        seoDescription: 'Apply lo-fi bitcrusher and sample rate reduction effects. Create retro 8-bit or crunchy audio textures. Free tool.',
    },
    'echo.hobo.tools': {
        toolId: 'echo', brandName: 'HoboEcho', defaultOp: 'echo',
        faIcon: 'fa-tower-broadcast',
        seoTitle: 'HoboEcho — Add Echo & Delay to Audio Online Free',
        seoDescription: 'Add echo, delay, and repeat effects to audio files. Customizable timing and decay. Free online tool.',
    },
    'reverb.hobo.tools': {
        toolId: 'reverb', brandName: 'HoboReverb', defaultOp: 'reverb',
        faIcon: 'fa-church',
        seoTitle: 'HoboReverb — Add Reverb to Audio Online Free',
        seoDescription: 'Add room reverb, hall, cathedral, and plate reverb effects to audio. Free online reverb tool.',
    },
    'chorus.hobo.tools': {
        toolId: 'chorus', brandName: 'HoboChorus', defaultOp: 'chorus',
        faIcon: 'fa-people-group',
        seoTitle: 'HoboChorus — Add Chorus Effect to Audio Online Free',
        seoDescription: 'Apply lush chorus effect to audio tracks. Thicken vocals and instruments. Free online chorus tool.',
    },
    'distortion.hobo.tools': {
        toolId: 'distortion', brandName: 'HoboDistortion', defaultOp: 'distortion',
        faIcon: 'fa-bolt',
        seoTitle: 'HoboDistortion — Add Distortion to Audio Online Free',
        seoDescription: 'Apply overdrive, fuzz, and distortion effects to audio. Great for guitars and creative sound design.',
    },
    'compressor.hobo.tools': {
        toolId: 'compressor', brandName: 'HoboCompressor', defaultOp: 'compressor',
        faIcon: 'fa-compress',
        seoTitle: 'HoboCompressor — Compress Audio Dynamics Online Free',
        seoDescription: 'Apply dynamic range compression to audio. Even out volume levels for professional-sounding results. Free tool.',
    },
    'stereo.hobo.tools': {
        toolId: 'stereo', brandName: 'HoboStereo', defaultOp: 'stereo',
        faIcon: 'fa-arrows-left-right',
        seoTitle: 'HoboStereo — Stereo/Mono Audio Converter Online Free',
        seoDescription: 'Convert audio between stereo and mono. Adjust stereo width and channel balance. Free online tool.',
    },
    'silence.hobo.tools': {
        toolId: 'silence', brandName: 'HoboSilence', defaultOp: 'silence',
        faIcon: 'fa-volume-xmark',
        seoTitle: 'HoboSilence — Remove Silence from Audio Online Free',
        seoDescription: 'Automatically detect and remove silent sections from audio files. Perfect for editing recordings. Free tool.',
    },
    'metadata.hobo.tools': {
        toolId: 'metadata', brandName: 'HoboMeta', defaultOp: 'metadata',
        faIcon: 'fa-tags',
        seoTitle: 'HoboMeta — Edit Audio Metadata & Tags Online Free',
        seoDescription: 'View and edit audio file metadata — title, artist, album, genre, year, artwork. ID3 tags for MP3. Free tool.',
    },

    // ── Aliases ──────────────────────────────────────────────
    'convert.audio.hobo.tools': {
        toolId: 'hub', brandName: 'HoboAudio', defaultOp: 'convert',
        faIcon: 'fa-headphones', alias: 'audio.hobo.tools',
        seoTitle: 'HoboAudio — Convert Audio Files Online Free',
        seoDescription: 'Convert between 20+ audio formats online. Free, fast audio converter.',
    },
};

const DEFAULT_CONTEXT = DOMAIN_MAP['audio.hobo.tools'];

/**
 * Resolve hostname to subdomain context.
 * @param {string} hostname - e.g. 'mp3.hobo.tools' (may include port)
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
