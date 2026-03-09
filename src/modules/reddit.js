/**
 * Reddit Scraper Module
 * Scrapes stealth camping, urban camping and dispersed camping posts from Reddit.
 * Uses Reddit's public JSON API (no auth needed for public posts).
 *
 * Subreddits targeted:
 *   - r/StealthCamping
 *   - r/urbancarliving
 *   - r/vandwellers
 *   - r/camping
 *   - r/WashingtonHiking
 *   - r/SeattleWA
 *   - r/PNWhiking
 */
const axios = require('axios');

const UA = 'HoboApp-WA/2.0';

const TARGET_SUBS = [
  'StealthCamping',
  'urbancarliving',
  'vandwellers',
  'WashingtonHiking',
  'PNWhiking',
  'camping',
  'SeattleWA',
];

const WA_KEYWORDS = [
  'washington', 'seattle', 'tacoma', 'spokane', 'olympia', 'bellingham',
  'everett', 'snohomish', 'arlington', 'granite falls', 'marysville',
  'mt baker', 'mount baker', 'cascades', 'olympic', 'rainier',
  'national forest', 'dispersed camp', 'dnr', 'blm land',
  'puget sound', 'san juan', 'whidbey', 'camano',
  'mountain loop', 'verlot', 'darrington', 'index',
  'leavenworth', 'cle elum', 'ellensburg', 'wenatchee',
  'north bend', 'snoqualmie', 'issaquah',
  'skagit', 'whatcom', 'kitsap', 'mason', 'clallam',
  'pacific northwest', 'pnw', 'wa state',
];

/**
 * Search Reddit for stealth camping posts mentioning Washington State areas.
 * Returns relevant posts with extracted location hints.
 */
async function searchReddit(searchQuery = 'stealth camping washington') {
  const posts = [];

  // Strategy 1: Reddit search API
  try {
    const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(searchQuery)}&sort=relevance&limit=50&type=link`;
    const resp = await axios.get(searchUrl, {
      headers: { 'User-Agent': UA },
      timeout: 10000,
    });
    const children = resp.data?.data?.children || [];
    for (const child of children) {
      const post = parseRedditPost(child.data);
      if (post) posts.push(post);
    }
  } catch (e) {
    console.warn('[Reddit Search]', e.message);
  }

  // Strategy 2: Scrape top posts from target subreddits
  for (const sub of TARGET_SUBS.slice(0, 4)) {
    try {
      const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent('washington OR seattle OR cascades OR dispersed OR snohomish')}&restrict_sr=1&sort=relevance&limit=25`;
      const resp = await axios.get(url, {
        headers: { 'User-Agent': UA },
        timeout: 8000,
      });
      const children = resp.data?.data?.children || [];
      for (const child of children) {
        const post = parseRedditPost(child.data);
        if (post && !posts.find(p => p.id === post.id)) {
          posts.push(post);
        }
      }
      // Rate-limit to be polite to Reddit
      await sleep(1200);
    } catch (e) {
      console.warn(`[Reddit r/${sub}]`, e.message);
    }
  }

  return posts;
}

/**
 * Parse a Reddit post into a useful data object.
 * Only return WA-relevant posts.
 */
function parseRedditPost(data) {
  if (!data) return null;

  const title = data.title || '';
  const body = data.selftext || '';
  const fullText = `${title} ${body}`.toLowerCase();

  // Check if WA-relevant
  const isRelevant = WA_KEYWORDS.some(kw => fullText.includes(kw));
  if (!isRelevant) return null;

  // Extract coordinate patterns from text (rare but possible)
  const coordMatch = fullText.match(/(\d{2}\.\d{3,})\s*[,\/]\s*(-?\d{2,3}\.\d{3,})/);
  let lat = null, lon = null;
  if (coordMatch) {
    lat = parseFloat(coordMatch[1]);
    lon = parseFloat(coordMatch[2]);
    if (lon > 0) lon = -lon; // WA is negative longitude
  }

  // Extract location hints
  const locationHints = extractLocationHints(fullText);

  // Extract tips/advice
  const tips = extractTips(body);

  return {
    id: `reddit-${data.id}`,
    title: data.title,
    subreddit: data.subreddit,
    author: data.author,
    score: data.score || 0,
    numComments: data.num_comments || 0,
    created: data.created_utc ? new Date(data.created_utc * 1000).toISOString() : null,
    url: `https://www.reddit.com${data.permalink}`,
    thumbnail: data.thumbnail !== 'self' && data.thumbnail !== 'default' ? data.thumbnail : null,
    body: body.substring(0, 500),
    lat, lon,
    locationHints,
    tips,
    flair: data.link_flair_text || null,
  };
}

/**
 * Extract location names from post text.
 */
function extractLocationHints(text) {
  const hints = [];
  const patterns = [
    /(?:near|at|around|by|in|off)\s+([\w\s]+(?:road|trail|creek|river|lake|mountain|pass|forest|park|hwy|highway))/gi,
    /(?:fr|forest road|nf)\s*(\d+)/gi,
    /(mountain loop|verlot|baker lake|darrington|granite falls|arlington|snohomish|index|skykomish|gold bar|sultan|monroe|everett)/gi,
    /(mt\.?\s*baker|mt\.?\s*rainier|olympic|cascades)/gi,
    /(gifford pinchot|okanogan|wenatchee|colville|snoqualmie)\s*(?:nf|national forest)?/gi,
    /(capitol state forest|tiger mountain|tahuya|elbe hills)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const hint = match[1] || match[0];
      if (hint && hint.length > 2 && !hints.includes(hint.trim())) {
        hints.push(hint.trim());
      }
    }
  }
  return hints.slice(0, 8);
}

/**
 * Extract camping tips from post text.
 */
function extractTips(text) {
  if (!text) return [];
  const tips = [];
  const sentences = text.split(/[.!?\n]+/);
  const tipKeywords = [
    'recommend', 'suggest', 'tip', 'advice', 'pro tip', 'make sure',
    'don\'t forget', 'bring', 'avoid', 'careful', 'watch out',
    'best time', 'arrive', 'leave', 'setup', 'stealth', 'discover pass',
    'forest road', 'pulloff', 'fire ring', 'water source',
  ];

  for (const sent of sentences) {
    const lower = sent.toLowerCase().trim();
    if (lower.length > 20 && lower.length < 300 && tipKeywords.some(kw => lower.includes(kw))) {
      tips.push(sent.trim());
    }
  }
  return tips.slice(0, 5);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { searchReddit, TARGET_SUBS };
