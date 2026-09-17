/*
 * Findet die Kartensets im Ordner Lernkarten/.
 *
 * Ein Browser kann einen Serverordner nicht auflisten, deshalb drei Wege —
 * keiner davon verlangt einen manuellen Eintrag, ein reiner Upload der .csv
 * genügt. Der erste Weg, der etwas liefert, gewinnt:
 *
 *   1. Lernkarten/decks.json wird beim GitHub-Pages-Build (Jekyll) aus dem
 *      Ordnerinhalt erzeugt. Das ist der Normalfall im Web.
 *   2. Verzeichnis-Listing, wie es lokale Entwicklungsserver ausliefern
 *      (z.B. `python3 -m http.server`). Greift ohne Netz und ohne Jekyll.
 *   3. Die GitHub-Contents-API — für den Fall, dass der Pages-Build noch nicht
 *      durch ist. Liest immer den Standard-Branch.
 *
 * Verwendung: await LernkartenDecks.list() -> ["Tierwelt.csv", ...]
 */
(function (global) {
  'use strict';

  const FOLDER = 'Lernkarten';
  // Einziger Ort, der nach einem Fork anzupassen wäre (nur für Weg 2 relevant).
  const REPO = 'florianschellenberg/LernkartenApp';

  // Aus "Innere_Medizin.csv" wird "Innere Medizin"
  function label(filename) {
    return filename.replace(/\.csv$/i, '').replace(/[_-]+/g, ' ').trim();
  }

  function path(filename) {
    return `${FOLDER}/${encodeURIComponent(filename)}`;
  }

  async function fromManifest() {
    const response = await fetch(`${FOLDER}/decks.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const names = JSON.parse(await response.text());
    if (!Array.isArray(names)) throw new Error('kein Array');
    return names.filter(name => /\.csv$/i.test(name));
  }

  // Lokale Entwicklungsserver liefern für einen Ordner eine HTML-Liste mit
  // Links. GitHub Pages tut das nicht — dort schlägt der Aufruf fehl oder die
  // 404-Seite enthält keine .csv-Links, und der nächste Weg übernimmt.
  async function fromDirectoryListing() {
    const response = await fetch(`${FOLDER}/`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const names = [];
    const link = /href="([^"]+?\.csv)"/gi;
    let match;

    while ((match = link.exec(html)) !== null) {
      const name = decodeURIComponent(match[1].split('/').pop());
      if (name && names.indexOf(name) === -1) names.push(name);
    }

    if (!names.length) throw new Error('kein Verzeichnis-Listing');
    return names;
  }

  async function fromApi() {
    const response = await fetch(`https://api.github.com/repos/${REPO}/contents/${FOLDER}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const items = await response.json();
    return items
      .filter(item => item.type === 'file' && /\.csv$/i.test(item.name))
      .map(item => item.name);
  }

  async function list() {
    const sources = [
      ['decks.json', fromManifest],
      ['Verzeichnis-Listing', fromDirectoryListing],
      ['GitHub-API', fromApi]
    ];

    for (const [label, source] of sources) {
      try {
        const names = await source();
        if (names.length) {
          console.log(`📚 ${names.length} Kartenset(s) über ${label} gefunden`);
          return names.sort((a, b) => a.localeCompare(b, 'de'));
        }
      } catch (error) {
        console.log(`ℹ️ ${label} nicht nutzbar: ${error.message}`);
      }
    }

    return [];
  }

  global.LernkartenDecks = { list: list, label: label, path: path, folder: FOLDER };

})(window);
