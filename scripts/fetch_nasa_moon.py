#!/usr/bin/env python3
"""Download and validate NASA SVS annual Moon Phase and Libration JSON."""
import calendar
import datetime as dt
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import time
from urllib.parse import urljoin
from urllib.request import Request, urlopen

PAGES = {
    2019: 4442, 2020: 4768, 2021: 4874, 2022: 4955,
    2023: 5048, 2024: 5187, 2025: 5415, 2026: 5587,
}
OUT = Path("data/moon")
HEADERS = {"User-Agent": "themoon-NASA-archive/1.0 (GitHub Pages project)"}

class JsonLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        for key, value in attrs:
            if key == "href" and value and "mooninfo" in value.lower() and ".json" in value.lower():
                self.urls.append(html.unescape(value))

def download(url):
    error = None
    for attempt in range(4):
        try:
            with urlopen(Request(url, headers=HEADERS), timeout=75) as response:
                return response.read()
        except Exception as exc:
            error = exc
            if attempt < 3:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Unable to retrieve {url}: {error}")

def verify(year, records):
    expected = (366 if calendar.isleap(year) else 365) * 24
    if not isinstance(records, list) or len(records) not in (expected, expected + 1):
        raise ValueError(f"{year}: unexpected record count {len(records)} (expected {expected} or {expected+1})")
    start = dt.datetime(year, 1, 1)
    for index, row in enumerate(records[:expected]):
        when = dt.datetime.strptime(row["time"], "%d %b %Y %H:%M UT")
        if when != start + dt.timedelta(hours=index):
            raise ValueError(f"{year}: hourly record {index} is not contiguous ({when})")
        for field in ("phase", "age", "distance", "diameter", "subsolar", "subearth", "posangle"):
            if field not in row:
                raise ValueError(f"{year}: missing {field} at {index}")
        if not 0 <= row["phase"] <= 100 or not 300000 <= row["distance"] <= 450000:
            raise ValueError(f"{year}: invalid measurement at {index}")
    if len(records) == expected + 1:
        endpoint = dt.datetime.strptime(records[-1]["time"], "%d %b %Y %H:%M UT")
        if endpoint != dt.datetime(year + 1, 1, 1):
            raise ValueError(f"{year}: unexpected final endpoint {endpoint}")

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for year, page_id in PAGES.items():
        page_url = f"https://svs.gsfc.nasa.gov/{page_id}"
        page = download(page_url).decode("utf-8")
        links = JsonLinks()
        links.feed(page)
        matches = [urljoin(page_url, link) for link in links.urls if str(year) in link]
        if not matches:
            raise RuntimeError(f"No official NASA mooninfo JSON link found for {year}: {page_url}")
        data_url = matches[0]
        body = download(data_url)
        records = json.loads(body)
        verify(year, records)
        (OUT / f"{year}.json").write_bytes(body)
        manifest[str(year)] = {"source_page": page_url, "source_json": data_url,
                               "records": len(records), "reference": "NASA SVS",
                               "timezone": "UTC", "type": "geocentric"}
        print(f"{year}: {len(records)} hourly records verified, {len(body)} bytes")
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
