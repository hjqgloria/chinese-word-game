#!/usr/bin/env python3
"""Wash src/chinese_words.json for use as game clues.

The raw CC-CEDICT glosses contain dictionary bookkeeping that makes bad
game clues: classifier tags (CL:...), cross-references ("see X", "variant
of X"), embedded Chinese characters with bracketed pinyin, and
paragraph-length definitions. Many pinyin fields also have missing or
misplaced tone marks. This script:

  1. drops entries whose gloss is only a cross-reference (unless overridden)
  2. strips classifier/abbreviation/reference parentheticals
  3. removes leftover Chinese + bracketed-pinyin fragments
  4. keeps at most the first two glosses, preferring concise clues
  5. regenerates ALL pinyin with pypinyin (correct tone marks)

Requires: pip install pypinyin
Usage: python3 scripts/wash_words.py
"""

import json
import re
from pathlib import Path

from pypinyin import pinyin

WORDS_PATH = Path(__file__).parent.parent / "src" / "chinese_words.json"

# Words whose CEDICT gloss is a useless cross-reference or a wrong sense
# pick, mapped to a proper game clue instead of being dropped.
OVERRIDES = {
    "安宁": "peaceful; tranquil",
    "比如": "for example; for instance",
    "金子": "gold",
}

# Glosses that are pure dictionary cross-references — no translation at all.
REFERENCE_START = re.compile(
    r"^\(?(?:coll\.\)?\s*)?(?:old |erhua )?variant of\b|^see (?:also )?\b", re.I
)

# Parentheticals that are dictionary bookkeeping rather than meaning.
PAREN = re.compile(r"\s*\([^()]*\)")
JUNK_PAREN = re.compile(r"CL:|abbr\.|[一-鿿]|\[[A-Za-z]+\d")

# Leftover inline fragments: 中文 or 中文|中文 optionally followed by [pin1 yin1].
CJK_FRAGMENT = re.compile(
    r"[一-鿿]+(?:\|[一-鿿]+)?(?:\[[^\]]*\])?"
)
PINYIN_BRACKET = re.compile(r"\[[A-Za-z][^\]]*\]")

MAX_CLUE_LEN = 70


def wash_gloss(gloss: str) -> str | None:
    """Return a cleaned clue, or None if the entry should be dropped."""
    gloss = gloss.strip()
    if REFERENCE_START.search(gloss):
        return None

    # Remove bookkeeping parentheticals, keep meaningful ones like "(language)".
    def _strip_paren(m: re.Match) -> str:
        return "" if JUNK_PAREN.search(m.group(0)) else m.group(0)

    gloss = PAREN.sub(_strip_paren, gloss)
    gloss = CJK_FRAGMENT.sub("", gloss)
    gloss = PINYIN_BRACKET.sub("", gloss)
    gloss = re.sub(r"^\(idiom\)\s*", "", gloss)
    gloss = re.sub(r"\s{2,}", " ", gloss)
    gloss = re.sub(r"\s+([;,])", r"\1", gloss)
    gloss = gloss.strip(" ;,")
    if not gloss:
        return None

    # Keep at most two glosses, and stay within a clue-sized budget.
    parts = [p.strip(" ,") for p in gloss.split(";") if p.strip(" ,")]
    if not parts:
        return None
    clue = parts[0]
    if len(parts) > 1 and len(clue) + len(parts[1]) + 2 <= MAX_CLUE_LEN:
        clue = f"{clue}; {parts[1]}"
    return clue


def regenerate_pinyin(word: str) -> str:
    return " ".join(s[0] for s in pinyin(word))


def main() -> None:
    words = json.loads(WORDS_PATH.read_text(encoding="utf-8"))
    washed, dropped, gloss_changed, pinyin_changed = [], [], 0, 0

    seen = set()
    for entry in words:
        chinese, old_pinyin, old_gloss = entry[0], entry[1], entry[2]
        if chinese in seen:
            continue
        seen.add(chinese)

        gloss = OVERRIDES.get(chinese) or wash_gloss(old_gloss)
        if gloss is None:
            dropped.append((chinese, old_gloss))
            continue
        new_pinyin = regenerate_pinyin(chinese)
        if gloss != old_gloss:
            gloss_changed += 1
        if new_pinyin != old_pinyin:
            pinyin_changed += 1
        washed.append([chinese, new_pinyin, gloss])

    WORDS_PATH.write_text(
        json.dumps(washed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"kept {len(washed)} / {len(words)} entries")
    print(f"dropped {len(dropped)} cross-reference entries")
    print(f"glosses cleaned: {gloss_changed}, pinyin fixed: {pinyin_changed}")
    for chinese, gloss in dropped[:10]:
        print(f"  dropped: {chinese} — {gloss[:60]}")


if __name__ == "__main__":
    main()
