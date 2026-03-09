#!/usr/bin/env python3
"""Add curated static WiFi and harm reduction data for Arlington/WA area."""

# ─── Patch wifi.js: add curated WiFi spots ───
with open('/home/deck/hobo/src/modules/wifi.js', 'r') as f:
    content = f.read()

curated_wifi = '''
// ═══════════════════════════════════════════════════════════════════
// CURATED WIFI SPOTS — Arlington / Snohomish / WA area
// ═══════════════════════════════════════════════════════════════════
const CURATED_WIFI = [
  { id: 'wifi-cur-1', name: 'Arlington Library', lat: 48.1989, lon: -122.1253, wifiType: 'library', description: 'Sno-Isle Libraries. Free WiFi inside and in parking lot. Power outlets at tables. Open M-Sat.', ssid: 'Sno-Isle_Public', hours: 'M-Th 10-8, F-Sa 10-5', amenities: ['Free WiFi', 'Outlets', 'Restrooms', 'Air Conditioning'] },
  { id: 'wifi-cur-2', name: 'Marysville Library', lat: 48.0520, lon: -122.1770, wifiType: 'library', description: 'Sno-Isle Libraries Marysville branch. Strong WiFi reaches parking lot after hours.', ssid: 'Sno-Isle_Public', hours: 'M-Th 10-8, F-Sa 10-5', amenities: ['Free WiFi', 'Outlets', 'Restrooms'] },
  { id: 'wifi-cur-3', name: 'Smokey Point Library (Lakewood)', lat: 48.1661, lon: -122.1966, wifiType: 'library', description: 'Sno-Isle Libraries branch at Smokey Point. Free WiFi extends to parking area.', ssid: 'Sno-Isle_Public', hours: 'M-Th 10-8, F-Sa 10-5', amenities: ['Free WiFi', 'Outlets', 'Restrooms'] },
  { id: 'wifi-cur-4', name: 'Starbucks - Arlington', lat: 48.1876, lon: -122.1414, wifiType: 'cafe', description: 'Starbucks on Smokey Point Blvd. Free Google WiFi for customers. Power outlets at bar seating.', ssid: 'Google Starbucks', hours: '5am-8pm daily', amenities: ['Free WiFi', 'Outlets'] },
  { id: 'wifi-cur-5', name: 'McDonald\\'s - Smokey Point', lat: 48.1683, lon: -122.1941, wifiType: 'fast_food', description: 'McDonald\\'s at Smokey Point. Free WiFi. Can sit in lobby or parking lot.', ssid: 'att-wifi', hours: '24hr (lobby closes 11pm)', amenities: ['Free WiFi', 'Restrooms'] },
  { id: 'wifi-cur-6', name: 'Safeway - Arlington', lat: 48.1953, lon: -122.1207, wifiType: 'free_public', description: 'Safeway grocery store. Free WiFi in store and parking lot.', ssid: 'Safeway_Free_Wi-Fi', hours: '5am-12am daily', amenities: ['Free WiFi', 'Restrooms'] },
  { id: 'wifi-cur-7', name: 'Arlington Community Center', lat: 48.2003, lon: -122.1262, wifiType: 'community', description: 'City community center. Free public WiFi during open hours.', hours: 'M-F 8am-9pm, Sa 9-5', amenities: ['Free WiFi', 'Restrooms', 'Outlets'] },
  { id: 'wifi-cur-8', name: 'Granite Falls Library', lat: 48.0839, lon: -121.9679, wifiType: 'library', description: 'Small Sno-Isle branch. WiFi reaches outside. Good for Mountain Loop Hwy staging.', ssid: 'Sno-Isle_Public', hours: 'Tu-Sa 10-6', amenities: ['Free WiFi', 'Outlets', 'Restrooms'] },
  { id: 'wifi-cur-9', name: 'Darrington Library', lat: 48.2548, lon: -121.6012, wifiType: 'library', description: 'Sno-Isle Libraries Darrington branch. Only free WiFi for miles. Critical for backcountry trips.', ssid: 'Sno-Isle_Public', hours: 'Tu-Sa 10-6', amenities: ['Free WiFi', 'Outlets'] },
  { id: 'wifi-cur-10', name: 'Everett Public Library - Main Branch', lat: 47.9793, lon: -122.2022, wifiType: 'library', description: 'Large downtown library. Strong WiFi, many outlets, study rooms.', hours: 'M-Th 10-8, F-Sa 10-5, Su 1-5', amenities: ['Free WiFi', 'Outlets', 'Restrooms', 'Air Conditioning'] },
  { id: 'wifi-cur-11', name: 'Stanwood Library', lat: 48.2410, lon: -122.3705, wifiType: 'library', description: 'Sno-Isle Libraries Stanwood branch. WiFi available in lot after hours.', ssid: 'Sno-Isle_Public', hours: 'M-Th 10-8, F-Sa 10-5', amenities: ['Free WiFi', 'Outlets', 'Restrooms'] },
  { id: 'wifi-cur-12', name: 'Fred Meyer - Marysville', lat: 48.0525, lon: -122.1525, wifiType: 'free_public', description: 'Fred Meyer store with free WiFi in lobby and parking lot.', hours: '6am-11pm daily', amenities: ['Free WiFi', 'Restrooms'] },
  { id: 'wifi-cur-13', name: 'Wendy\\'s - Smokey Point', lat: 48.1675, lon: -122.1930, wifiType: 'fast_food', description: 'Wendy\\'s at Smokey Point. Free WiFi for customers.', hours: '6:30am-1am daily', amenities: ['Free WiFi'] },
  { id: 'wifi-cur-14', name: 'Seattle Public Library - Central', lat: 47.6067, lon: -122.3326, wifiType: 'library', description: 'Iconic Rem Koolhaas building downtown. Massive free WiFi, hundreds of outlets, restrooms on every floor.', ssid: 'SPL-WiFi', hours: 'M-Th 10-8, F-Sa 10-6, Su 12-6', amenities: ['Free WiFi', 'Outlets', 'Restrooms', 'Air Conditioning', 'Wheelchair Accessible'] },
  { id: 'wifi-cur-15', name: 'Bellingham Public Library', lat: 48.7509, lon: -122.4782, wifiType: 'library', description: 'Central branch with strong WiFi and outlets. Reaches parking lot.', hours: 'M-Th 10-9, F-Sa 10-6, Su 1-5', amenities: ['Free WiFi', 'Outlets', 'Restrooms'] },
];
'''

# Insert curated list before findWifi function
marker = 'async function findWifi'
content = content.replace(marker, curated_wifi + '\n' + marker, 1)

# Modify findWifi to merge curated data
old_return = """    wifiSpots.sort((a, b) => a.distanceMiles - b.distanceMiles);
    return { wifi: wifiSpots };
  } catch (err) {
    console.error('[WiFi] Overpass error:', err.message);
    return { wifi: [] };
  }"""

new_return = """    // Merge curated WiFi spots that are within search radius
    const curatedInRange = CURATED_WIFI
      .map(c => {
        const dist = haversine(lat, lon, c.lat, c.lon);
        if (dist > radiusMiles) return null;
        const t = WIFI_TYPES[c.wifiType] || WIFI_TYPES.other;
        return {
          ...c,
          distanceMiles: Math.round(dist * 100) / 100,
          typeLabel: t.label,
          icon: t.icon,
          color: t.color,
          fee: 'no',
          curated: true,
        };
      })
      .filter(Boolean)
      .filter(c => !wifiSpots.some(w =>
        Math.abs(w.lat - c.lat) < 0.001 && Math.abs(w.lon - c.lon) < 0.001
      ));

    const all = [...wifiSpots, ...curatedInRange];
    all.sort((a, b) => a.distanceMiles - b.distanceMiles);
    return { wifi: all };
  } catch (err) {
    console.error('[WiFi] Overpass error:', err.message);
    // Return curated data as fallback on Overpass failure
    const curatedFallback = CURATED_WIFI
      .map(c => {
        const dist = haversine(lat, lon, c.lat, c.lon);
        if (dist > radiusMiles) return null;
        const t = WIFI_TYPES[c.wifiType] || WIFI_TYPES.other;
        return { ...c, distanceMiles: Math.round(dist * 100) / 100, typeLabel: t.label, icon: t.icon, color: t.color, fee: 'no', curated: true };
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceMiles - b.distanceMiles);
    return { wifi: curatedFallback };
  }"""

content = content.replace(old_return, new_return, 1)

with open('/home/deck/hobo/src/modules/wifi.js', 'w') as f:
    f.write(content)

print(f'wifi.js patched with curated data ({len(content.splitlines())} lines)')


# ─── Patch harmreduction.js: add curated harm reduction services ───
with open('/home/deck/hobo/src/modules/harmreduction.js', 'r') as f:
    content = f.read()

curated_hr = '''
// ═══════════════════════════════════════════════════════════════════
// CURATED HARM REDUCTION SERVICES — Washington State
// ═══════════════════════════════════════════════════════════════════
const CURATED_SERVICES = [
  { id: 'hr-cur-1', name: 'People\\'s Harm Reduction Alliance', lat: 47.6144, lon: -122.3208, hrType: 'needle_exchange', description: 'Seattle\\'s largest SSP. Free syringes, naloxone, fentanyl test strips, wound care, HIV/HCV testing. Walk-in friendly. Multiple weekly locations.', website: 'https://peoplesharmreductionalliance.org', phone: '206-432-PHRA', hours: 'See website for schedule', amenities: ['Clean Syringes', 'Naloxone/Narcan', 'Fentanyl Test Strips', 'HIV Testing', 'Wound Care', 'Free Condoms'] },
  { id: 'hr-cur-2', name: 'North Sound Accountable Communities of Health', lat: 48.1989, lon: -122.1253, hrType: 'harm_reduction', description: 'Regional health initiative covering Snohomish, Skagit, Island, San Juan, Whatcom counties. Overdose prevention, naloxone distribution.', website: 'https://northsoundach.org', amenities: ['Naloxone/Narcan', 'Health Education'] },
  { id: 'hr-cur-3', name: 'Snohomish County Syringe Services', lat: 47.9793, lon: -122.2022, hrType: 'needle_exchange', description: 'County-authorized SSP in Everett. Clean syringes, safe disposal, naloxone, HIV/HCV testing. No ID required.', hours: 'M-F variable, call ahead', amenities: ['Clean Syringes', 'Naloxone/Narcan', 'HIV Testing', 'HCV Testing', 'Safe Disposal'] },
  { id: 'hr-cur-4', name: 'Downtown Emergency Service Center (DESC)', lat: 47.6013, lon: -122.3320, hrType: 'outreach', description: 'Comprehensive services for people experiencing homelessness. Mental health, substance use support, housing. Multiple Seattle locations.', website: 'https://www.desc.org', phone: '206-464-1570', amenities: ['Mental Health', 'Substance Use Support', 'Housing Referral'] },
  { id: 'hr-cur-5', name: 'Planned Parenthood - Everett', lat: 47.9756, lon: -122.2003, hrType: 'family_planning', description: 'Sexual & reproductive health. Free condoms, STI testing, PrEP, birth control. Sliding scale fees. Walk-ins accepted for some services.', website: 'https://www.plannedparenthood.org', phone: '1-800-230-7526', hours: 'M-F 8am-5pm', amenities: ['Free Condoms', 'STI Testing', 'PrEP', 'Birth Control', 'Sliding Scale'] },
  { id: 'hr-cur-6', name: 'Planned Parenthood - Mount Vernon', lat: 48.4214, lon: -122.3346, hrType: 'family_planning', description: 'Sexual health services for Skagit Valley. Free condoms, testing, contraception.', website: 'https://www.plannedparenthood.org', phone: '1-800-230-7526', hours: 'M-F 9am-5pm', amenities: ['Free Condoms', 'STI Testing', 'Birth Control'] },
  { id: 'hr-cur-7', name: 'Compass Health - Arlington Clinic', lat: 48.2013, lon: -122.1261, hrType: 'addiction_counsel', description: 'Behavioral health services including substance use disorder treatment. Accepts Medicaid. Serves Snohomish County.', website: 'https://www.compasshealth.org', phone: '425-349-6200', hours: 'M-F 8am-5pm', amenities: ['Addiction Counseling', 'Mental Health', 'Medicaid Accepted'] },
  { id: 'hr-cur-8', name: 'Skagit County Needle Exchange', lat: 48.4489, lon: -122.3372, hrType: 'needle_exchange', description: 'Syringe services program serving Skagit County from the Public Health building in Mount Vernon. Free naloxone kits.', hours: 'Tu-Th 9am-4pm', amenities: ['Clean Syringes', 'Naloxone/Narcan', 'Safe Disposal'] },
  { id: 'hr-cur-9', name: 'SRHD Syringe Services - Spokane', lat: 47.6553, lon: -117.4256, hrType: 'needle_exchange', description: 'Spokane Regional Health District SSP. Free clean syringes, naloxone, HIV testing. No questions, no ID.', website: 'https://srhd.org', hours: 'M-F 8am-4pm', amenities: ['Clean Syringes', 'Naloxone/Narcan', 'HIV Testing', 'Safe Disposal'] },
  { id: 'hr-cur-10', name: 'Tacoma Needle Exchange (TNEX)', lat: 47.2495, lon: -122.4381, hrType: 'needle_exchange', description: 'Tacoma\\'s syringe exchange. Clean works, safe disposal, naloxone, wound care. Peer support.', hours: 'M-F 8:30am-4pm', amenities: ['Clean Syringes', 'Naloxone/Narcan', 'Wound Care', 'Peer Support'] },
  { id: 'hr-cur-11', name: 'Night Owl Outreach - Whatcom Co', lat: 48.7509, lon: -122.4782, hrType: 'outreach', description: 'Street outreach in Bellingham/Whatcom County. Distributes naloxone, clean supplies, food. Mobile harm reduction.', amenities: ['Naloxone/Narcan', 'Clean Syringes', 'Food', 'Outreach'] },
  { id: 'hr-cur-12', name: 'WA State Naloxone Hotline', lat: 47.0379, lon: -122.9007, hrType: 'naloxone', description: 'Statewide naloxone by mail program. Call to get free Narcan mailed to you anywhere in WA state. No questions asked.', phone: '1-888-811-NARCAN', website: 'https://stopoverdose.org', amenities: ['Naloxone/Narcan', 'Free by Mail', 'Statewide'] },
];
'''

marker = 'async function findHarmReduction'
content = content.replace(marker, curated_hr + '\n' + marker, 1)

# Modify findHarmReduction to merge curated data
old_return = """    services.sort((a, b) => a.distanceMiles - b.distanceMiles);
    return { services };
  } catch (err) {
    console.error('[HarmReduction] Overpass error:', err.message);
    return { services: [] };
  }"""

new_return = """    // Merge curated services within search radius
    const curatedInRange = CURATED_SERVICES
      .map(c => {
        const dist = haversine(lat, lon, c.lat, c.lon);
        if (dist > radiusMiles) return null;
        const t = HR_TYPES[c.hrType] || HR_TYPES.social_health;
        return {
          ...c,
          distanceMiles: Math.round(dist * 100) / 100,
          typeLabel: t.label,
          icon: t.icon,
          color: t.color,
          fee: false,
          curated: true,
        };
      })
      .filter(Boolean)
      .filter(c => !services.some(s =>
        Math.abs(s.lat - c.lat) < 0.001 && Math.abs(s.lon - c.lon) < 0.001
      ));

    const all = [...services, ...curatedInRange];
    all.sort((a, b) => a.distanceMiles - b.distanceMiles);
    return { services: all };
  } catch (err) {
    console.error('[HarmReduction] Overpass error:', err.message);
    // Return curated data as fallback on Overpass failure
    const curatedFallback = CURATED_SERVICES
      .map(c => {
        const dist = haversine(lat, lon, c.lat, c.lon);
        if (dist > radiusMiles) return null;
        const t = HR_TYPES[c.hrType] || HR_TYPES.social_health;
        return { ...c, distanceMiles: Math.round(dist * 100) / 100, typeLabel: t.label, icon: t.icon, color: t.color, fee: false, curated: true };
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceMiles - b.distanceMiles);
    return { services: curatedFallback };
  }"""

content = content.replace(old_return, new_return, 1)

with open('/home/deck/hobo/src/modules/harmreduction.js', 'w') as f:
    f.write(content)

print(f'harmreduction.js patched with curated data ({len(content.splitlines())} lines)')
