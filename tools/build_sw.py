"""Regenerate the precache list in sw.js. Run after changing assets or voice clips."""
import hashlib, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
files = ['index.html', 'styles.css', 'manifest.webmanifest', 'vendor/three.module.js', 'fonts/baloo2-latin.woff2']
for d in ['src', 'icons', 'voice']:
    files += sorted(f'{d}/{f}' for f in os.listdir(d) if not f.startswith('.'))
h = hashlib.sha1()
for f in files:
    h.update(open(f, 'rb').read())
sw = open('sw.js').read()
sw = re.sub(r"const CACHE = '[^']*';", f"const CACHE = 'bebefinn-{h.hexdigest()[:8]}';", sw)
sw = re.sub(r"const ASSETS = \[.*?\];", 'const ASSETS = ' + repr(['./'] + files) + ';', sw, flags=re.S)
open('sw.js', 'w').write(sw)
print(len(files) + 1, 'assets')
