#!/usr/bin/env python3
"""Keeps the "Contents" list of each long Markdown doc in sync with its headings.

GitHub does not render the [TOC] directive from the Google Markdown style guide,
so each long doc carries a plain Markdown list of links instead.

Usage:
  python3 scripts/update-toc.py          # rewrite the lists in place
  python3 scripts/update-toc.py --check  # exit 1 if any list is out of date
"""

import glob
import os
import re
import sys

MIN_LINES = 60
MIN_SECTIONS = 3


def slug(heading):
  """Returns GitHub's anchor for a heading."""
  text = re.sub(r'!?\[([^\]]*)\]\([^)]*\)', r'\1', heading)
  text = re.sub(r'[`*_~]', '', text).strip().lower()
  text = re.sub(r'[^\w\- ]', '', text)
  return text.replace(' ', '-')


def headings(lines):
  """Yields (index, level, text) for headings outside fenced code."""
  fenced = False
  for index, line in enumerate(lines):
    if re.match(r'^\s*(```|~~~)', line):
      fenced = not fenced
    match = None if fenced else re.match(r'^(#{1,6}) (.+)$', line)
    if match:
      yield index, len(match.group(1)), match.group(2).strip()


def update(text):
  lines = text.split('\n')
  # Drop an existing Contents section (heading, list and trailing blank line).
  for index, level, title in list(headings(lines)):
    if level == 2 and title == 'Contents':
      end = index + 1
      while end < len(lines) and not lines[end].startswith('#'):
        end += 1
      del lines[index:end]
      break
  sections = [(i, t) for i, level, t in headings(lines) if level == 2]
  if len(lines) <= MIN_LINES or len(sections) < MIN_SECTIONS:
    return '\n'.join(lines)
  seen, items = {}, []
  for _, title in sections:
    anchor = slug(title)
    count = seen.get(anchor, 0)
    seen[anchor] = count + 1
    items.append('*   [%s](#%s)' % (title, anchor if not count else
                                    '%s-%d' % (anchor, count)))
  block = ['## Contents', ''] + items + ['']
  lines[sections[0][0]:sections[0][0]] = block
  return '\n'.join(lines)


def main():
  root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
  paths = sorted(glob.glob(root + '/*.md') +
                 glob.glob(root + '/docs/**/*.md', recursive=True))
  stale = []
  for path in paths:
    with open(path, encoding='utf-8') as f:
      old = f.read()
    new = update(old)
    if new != old:
      stale.append(os.path.relpath(path, root))
      if '--check' not in sys.argv:
        with open(path, 'w', encoding='utf-8') as f:
          f.write(new)
  if stale and '--check' in sys.argv:
    print('Contents out of date: ' + ', '.join(stale), file=sys.stderr)
    return 1
  return 0


if __name__ == '__main__':
  sys.exit(main())
