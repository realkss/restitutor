# Wikipedia page captures

Two articles as served by Wikipedia, saved byte for byte on 2026-09-02 and used by `extension/src/page.real.test.ts` to run the extension's page reading — carrier scan, section spans, convention detection, declared and defined symbols, fork recovery, translation — over real markup in node, with linkedom standing in for the browser.

| File | Article | Captured |
| --- | --- | --- |
| `einstein-field-equations.en.html` | [Einstein field equations](https://en.wikipedia.org/wiki/Einstein_field_equations), English Wikipedia | 2026-09-02 |
| `einstein-field-equations.ar.html` | [معادلات الحقل لأينشتاين](https://ar.wikipedia.org/wiki/%D9%85%D8%B9%D8%A7%D8%AF%D9%84%D8%A7%D8%AA_%D8%A7%D9%84%D8%AD%D9%82%D9%84_%D9%84%D8%A3%D9%8A%D9%86%D8%B4%D8%AA%D8%A7%D9%8A%D9%86), Arabic Wikipedia | 2026-09-02 |

The only edit is the removal of a stylesheet link and a script tag the capturing session had appended for a local preview.

## License

The text of these two files is the work of Wikipedia contributors and is licensed under the [Creative Commons Attribution-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-sa/4.0/) (and, for older contributions, the GNU Free Documentation License), as stated on each article's page. The article history at the linked URLs lists the authors. These two files are **not** covered by this repository's MIT license; they are redistributed here under CC BY-SA 4.0, unmodified apart from the edit above, for the purpose of testing against real markup. Nothing else in the repository derives from them.

The corresponding ar5iv and arXiv HTML captures used during development are under the authors' copyright and are deliberately not committed.
