from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
SITE_ORIGIN = "https://regtechnexusai.com"
EXPECTED_VERSION = "v45"

class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
        self.canonicals = []
        self.versions = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "link":
            href = attrs.get("href", "")
            if href:
                self.refs.append(href)
            if attrs.get("rel", "").lower() == "canonical":
                self.canonicals.append(attrs.get("href", ""))
        if tag == "script":
            src = attrs.get("src", "")
            if src:
                self.refs.append(src)
        for key in ("src", "href"):
            value = attrs.get(key, "")
            if value and (".js?" in value or ".css?" in value):
                self.versions.append(value)

def main():
    errors = []
    pages = sorted(ROOT.glob("*.html"))
    if not pages:
        errors.append("No HTML pages found")

    for page in pages:
        parser = Assets()
        parser.feed(page.read_text(encoding="utf-8"))
        if len(parser.canonicals) != 1:
            errors.append(f"{page.name}: expected exactly one canonical URL, found {len(parser.canonicals)}")
        elif not parser.canonicals[0].startswith(SITE_ORIGIN + "/tradeguard/"):
            errors.append(f"{page.name}: canonical URL is not on the production TradeGuard domain: {parser.canonicals[0]}")

        for ref in parser.refs:
            parsed = urlsplit(ref)
            if parsed.scheme or parsed.netloc or ref.startswith(("#", "mailto:", "tel:", "data:", "javascript:")):
                continue
            path = parsed.path
            if not path or path.startswith("/"):
                continue
            target = (page.parent / path).resolve()
            if not target.exists():
                errors.append(f"{page.name}: missing local asset/link {ref}")

        for ref in parser.versions:
            if EXPECTED_VERSION not in ref:
                errors.append(f"{page.name}: stale asset cache key {ref}")

    version_file = ROOT / "site-version.js"
    if not version_file.exists() or f'BUILD_VERSION = "{EXPECTED_VERSION}"' not in version_file.read_text(encoding="utf-8"):
        errors.append(f"site-version.js: build version is not {EXPECTED_VERSION}")

    for js in ROOT.glob("*.js"):
        source = js.read_text(encoding="utf-8")
        for match in re.finditer(r'import\s+(?:[^;]*?\s+from\s+)?["\'](\./[^"\']+)["\']', source):
            ref = match.group(1).split("?", 1)[0]
            if not (ROOT / ref[2:]).exists():
                errors.append(f"{js.name}: missing local module import {ref}")

    if errors:
        for error in errors:
            print(f"FAIL: {error}")
        return 1

    print(f"PASS: {len(pages)} HTML pages, relative local assets, module imports, canonical URLs and {EXPECTED_VERSION} cache keys verified.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
