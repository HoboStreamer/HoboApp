#!/usr/bin/env python3
"""Patch main.js to wire in wifi and harmreduction modules."""

with open('/home/deck/hobo/src/main.js', 'r') as f:
    content = f.read()

# 1) Add requires after crimedata
old_req = "const crimedata = require('./modules/crimedata');"
new_req = old_req + "\nconst wifi = require('./modules/wifi');\nconst harmreduction = require('./modules/harmreduction');"
content = content.replace(old_req, new_req, 1)

# 2) Add source entries before ].filter(...)
filter_marker = "].filter(s => !disabledSources"
idx = content.index(filter_marker)
# Find the start of the line containing the filter
line_start = content.rfind('\n', 0, idx) + 1

new_sources = """    {
      name: 'Free WiFi',
      fn: async () => {
        const { wifi: wifiSpots } = await wifi.findWifi(lat, lon, Math.min(radiusMiles, 15));
        return wifiSpots.map(w => ({
          id: w.id,
          name: w.name,
          description: w.description,
          lat: w.lat,
          lon: w.lon,
          distanceMiles: w.distanceMiles,
          type: w.typeLabel,
          source: 'Free WiFi',
          sourceIcon: w.icon || 'fa-wifi',
          reservable: false,
          url: w.website || null,
          fee: w.fee === 'no' ? 'Free' : w.fee === 'customers' ? 'Free for customers' : 'Unknown',
          stealthRating: 1,
          tags: ['wifi', 'free', w.wifiType],
          amenities: w.amenities || [],
          wifiType: w.wifiType,
          wifiColor: w.color,
        }));
      },
    },
    {
      name: 'Harm Reduction',
      fn: async () => {
        const { services } = await harmreduction.findHarmReduction(lat, lon, Math.min(radiusMiles, 20));
        return services.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          lat: s.lat,
          lon: s.lon,
          distanceMiles: s.distanceMiles,
          type: s.typeLabel,
          source: 'Harm Reduction',
          sourceIcon: s.icon || 'fa-syringe',
          reservable: false,
          url: s.website || null,
          fee: s.fee === false ? 'Free' : s.fee === true ? 'Fee required' : 'Varies',
          stealthRating: 1,
          tags: ['harm-reduction', s.hrType],
          amenities: s.amenities || [],
          hrType: s.hrType,
          hrColor: s.color,
        }));
      },
    },
"""

content = content[:line_start] + new_sources + content[line_start:]

# 3) Update header comment
content = content.replace('Data Sources (18 integrated):', 'Data Sources (20 integrated):')
content = content.replace(
    "18. Crime Intel",
    "18. Crime Intel\n *  19. Free WiFi (dedicated OSM WiFi hotspot finder)\n *  20. Harm Reduction (needle exchanges, condoms, naloxone, community health)"
)

with open('/home/deck/hobo/src/main.js', 'w') as f:
    f.write(content)

print(f'main.js patched successfully ({len(content.splitlines())} lines)')
