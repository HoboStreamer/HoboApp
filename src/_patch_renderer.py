#!/usr/bin/env python3
"""Patch renderer.js to add SOURCE_META entries for Free WiFi and Harm Reduction."""

with open('/home/deck/hobo/src/renderer.js', 'r') as f:
    content = f.read()

# Add two entries after Crime Intel in SOURCE_META
old_meta = "'Crime Intel':   { icon: 'fa-skull-crossbones',   label: 'Crime & Sketch Zones' },"
new_meta = old_meta + "\n    'Free WiFi':      { icon: 'fa-wifi',              label: 'Free WiFi Hotspots (OSM)' },\n    'Harm Reduction': { icon: 'fa-syringe',           label: 'Harm Reduction & Community Health' },"

content = content.replace(old_meta, new_meta, 1)

with open('/home/deck/hobo/src/renderer.js', 'w') as f:
    f.write(content)

print(f'renderer.js patched successfully ({len(content.splitlines())} lines)')
