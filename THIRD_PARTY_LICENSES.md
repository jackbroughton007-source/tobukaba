# TobuKaba third-party notices

This file documents the optional stroke-order integration and where its original licence texts are preserved.

## Hanzi Writer

- Package: `hanzi-writer`
- Pinned version: `3.7.3`
- Source: https://github.com/chanind/hanzi-writer
- Runtime file: `https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.3/dist/hanzi-writer.min.js`
- Licence: MIT
- Original licence text: [`licenses/hanzi-writer/LICENSE`](licenses/hanzi-writer/LICENSE)

## Japanese stroke data

- Project: `hanzi-writer-data-jp`
- Release represented by the source commit: `0.0.2`
- Pinned commit: `efbea0cb93ba0301475ae92f9d3e512b9e4cd2ca`
- Source: https://github.com/chanind/hanzi-writer-data-jp/tree/efbea0cb93ba0301475ae92f9d3e512b9e4cd2ca
- Runtime data path: `https://cdn.jsdelivr.net/gh/chanind/hanzi-writer-data-jp@efbea0cb93ba0301475ae92f9d3e512b9e4cd2ca/data/<character>.json`

The Japanese character data is not licensed under the Hanzi Writer MIT licence. Its upstream copyright, provenance, and licence texts are preserved verbatim at:

- [`licenses/hanzi-writer-data-jp/COPYING.txt`](licenses/hanzi-writer-data-jp/COPYING.txt)
- [`licenses/hanzi-writer-data-jp/ARPHICPL.TXT`](licenses/hanzi-writer-data-jp/ARPHICPL.TXT)
- [`licenses/hanzi-writer-data-jp/LGPL.txt`](licenses/hanzi-writer-data-jp/LGPL.txt)

The published npm archive for `hanzi-writer-data-jp@0.0.2` does not contain the per-character JSON files. TobuKaba therefore uses the same release commit through jsDelivr’s GitHub endpoint and pins the full commit hash for reproducibility.

## Runtime and privacy behavior

The Hanzi Writer library is loaded as a pinned browser script. Character data is not downloaded during initial page load. After the learner reveals an answer and explicitly opens stroke-order guidance, TobuKaba requests only the individual public JSON file for each kanji in that word. These requests contain no account identity, vocabulary records, SRS state, ratings, or review results.

Successful character data is cached only in memory for the current page session. Stroke-order UI state is not stored locally and is not synced to Supabase.
