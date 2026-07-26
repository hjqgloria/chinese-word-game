import json, urllib.request, gzip, re, os, sys

CEDICT_URL = "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz"
OUTPUT = os.path.join(os.path.dirname(__file__), "..", "src", "chinese_words.json")

OBSCURE = re.compile(
    "(variant of|surname|chemistry|physics|biology|geology|philosophy|"
    "botany|zoology|astronomy|algebra|calculus|bacterium|virus|surgery|"
    "diagnosis|syndrome|alloy|chromosome|catalyst|enzyme|metabolism|"
    "county|district|province|prefecture|mountain|river|banner|league|"
    "town|village|city in|town in|area in|region in|part of|archipelago|"
    "peninsula|gulf|strait|kingdom|dynasty|emperor|empire|buddhist|"
    "biblical|islamic|christian|saint|holiday|loanword|old name|former name|"
    "also written|also pr|see also|CL:)",
    re.I
)

def to_tone_marks(s):
    s = s.lower()
    replacements = [
        ("a1", "ā"), ("a2", "á"), ("a3", "ǎ"), ("a4", "à"),
        ("e1", "ē"), ("e2", "é"), ("e3", "ě"), ("e4", "è"),
        ("i1", "ī"), ("i2", "í"), ("i3", "ǐ"), ("i4", "ì"),
        ("o1", "ō"), ("o2", "ó"), ("o3", "ǒ"), ("o4", "ò"),
        ("u1", "ū"), ("u2", "ú"), ("u3", "ǔ"), ("u4", "ù"),
        ("ü1", "ǖ"), ("ü2", "ǘ"), ("ü3", "ǚ"), ("ü4", "ǜ"),
        ("v1", "ǖ"), ("v2", "ǘ"), ("v3", "ǚ"), ("v4", "ǜ"),
        ("u:", "ü"),
    ]
    for old, new in replacements:
        s = s.replace(old, new)
    s = re.sub(r"[1-5]", "", s)
    return s

def main():
    print("Downloading CC-CEDICT...")
    data = urllib.request.urlopen(CEDICT_URL).read()
    print("Decompressing...")
    text = gzip.decompress(data).decode("utf-8")
    print("Parsing...")
    entries = []
    seen = set()
    LINE_RE = re.compile(r"^[^ ]+ ([^ ]+) \[([^\]]+)\] \/([^/]+)")
    for line in text.split("\n"):
        if not line or line[0] == "#":
            continue
        m = LINE_RE.match(line)
        if not m:
            continue
        simplified, pinyin_raw, english = m.group(1), m.group(2), m.group(3).strip()
        if len(simplified) < 2 or len(simplified) > 4:
            continue
        if simplified in seen:
            continue
        if re.search(r"[a-zA-Z0-9]", simplified):
            continue
        if OBSCURE.search(english):
            continue
        if re.match(r"^[A-Z][a-z]+$", english):
            continue
        pinyin = to_tone_marks(pinyin_raw)
        seen.add(simplified)
        entries.append([simplified, pinyin, english])
    print(f"Found {len(entries)} words")
    entries.sort(key=lambda x: x[0])
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
    print(f"Written to {OUTPUT}")

if __name__ == "__main__":
    main()
