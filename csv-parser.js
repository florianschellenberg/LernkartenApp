/*
 * Gemeinsamer CSV-Parser für die Lernkarten-App.
 *
 * Ziel: eine beliebige .csv soll ohne Nacharbeit funktionieren. Deshalb werden
 * BOM, CRLF, Semikolon-/Tab-Trenner (deutsche Excel-Exporte), Kopfzeilen und
 * mehrzeilige Felder in Anführungszeichen automatisch erkannt.
 *
 * Verwendung: LernkartenCSV.parse(text) -> { cards: [{id, question, answer}], skipped: n }
 */
(function (global) {
  'use strict';

  // Nur wenn BEIDE Zellen wie Spaltenüberschriften aussehen, wird Zeile 1 verworfen.
  const HEADER_QUESTION = /^(frage|fragen|question|front|vorderseite|begriff|term)$/i;
  const HEADER_ANSWER = /^(antwort|antworten|answer|back|rückseite|rueckseite|definition)$/i;

  const DELIMITERS = [',', ';', '\t'];

  function normalize(text) {
    return String(text)
      .replace(/^\uFEFF/, '')      // BOM
      .replace(/\r\n?/g, '\n');     // CRLF / CR
  }

  // Zählt die Trennzeichen-Kandidaten außerhalb von Anführungszeichen; der
  // häufigste gewinnt. Quoting-Regeln sind vom Trennzeichen unabhängig, deshalb
  // reicht ein Durchlauf für alle Kandidaten.
  function detectDelimiter(text) {
    const counts = { ',': 0, ';': 0, '\t': 0 };
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (!inQuotes && counts.hasOwnProperty(ch)) counts[ch]++;
    }

    let best = ',';
    for (const d of DELIMITERS) {
      if (counts[d] > counts[best]) best = d;
    }
    return best;
  }

  // RFC-4180-Zustandsautomat: Trennzeichen und Zeilenumbrüche innerhalb von
  // Anführungszeichen gehören zum Feld, "" ist ein escaptes Anführungszeichen.
  // Jedes Feld merkt sich, ob es in Anführungszeichen stand — das entscheidet
  // später über die Spaltenzuordnung.
  function parseRows(text, delimiter) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    let inQuotes = false;

    function endField() {
      row.push({ value: field, quoted: quoted });
      field = '';
      quoted = false;
    }

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else {
          field += ch;
        }
        continue;
      }

      if (ch === '"' && field.trim() === '') {
        field = '';                 // führende Leerzeichen vor dem Quote verwerfen
        quoted = true;
        inQuotes = true;
      } else if (ch === delimiter) {
        endField();
      } else if (ch === '\n') {
        endField();
        rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }

    endField();
    if (row.some(cell => cell.value.trim() !== '')) rows.push(row);

    return rows;
  }

  /*
   * Ordnet die Felder einer Zeile Frage und Antwort zu.
   *
   * Der einfache Fall sind zwei Felder. Zerfällt eine Zeile in mehr Felder, gibt
   * es zwei mögliche Ursachen, die unterschiedlich behandelt werden müssen:
   *
   *   a) Die Frage enthält ein unquotetes Trennzeichen — verbreitet, z.B.
   *      `Grundeinstellung 'Ich bin OK, du bist OK'?,"Antwort"`. Hier gehören die
   *      vorderen Felder wieder zusammen.
   *   b) Die Datei hat echte Zusatzspalten (Kategorie, Quelle, ...), die ignoriert
   *      werden sollen.
   *
   * Unterscheidungsmerkmal ist das erste *quotete* Feld ab Position 1: es ist die
   * Antwort. Alles davor ist die Frage, alles danach Zusatzspalte. Gibt es kein
   * quotetes Feld, greift die Standardannahme Spalte 0 / Spalte 1.
   */
  function pickFields(row, delimiter) {
    if (row.length <= 2) {
      return { question: (row[0] || { value: '' }).value, answer: (row[1] || { value: '' }).value };
    }

    let answerIndex = -1;
    for (let i = 1; i < row.length; i++) {
      if (row[i].quoted) { answerIndex = i; break; }
    }

    if (answerIndex === -1) {
      return { question: row[0].value, answer: row[1].value };
    }

    const question = row.slice(0, answerIndex).map(cell => cell.value).join(delimiter);
    return { question: question, answer: row[answerIndex].value };
  }

  function looksLikeHeader(row) {
    return row.length >= 2 &&
      HEADER_QUESTION.test(row[0].value.trim()) &&
      HEADER_ANSWER.test(row[1].value.trim());
  }

  // FNV-1a: stabile ID aus dem Fragetext. Eine laufende Nummer würde den
  // gespeicherten Lernfortschritt verschieben, sobald eine Karte in der Mitte
  // der Datei eingefügt oder gelöscht wird.
  function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return 'c' + h.toString(16);
  }

  function parse(csvText) {
    const text = normalize(csvText);
    const delimiter = detectDelimiter(text);
    const rows = parseRows(text, delimiter);
    const cards = [];
    const seen = Object.create(null);
    let skipped = 0;

    rows.forEach((row, index) => {
      if (index === 0 && looksLikeHeader(row)) return;

      const picked = pickFields(row, delimiter);
      const question = picked.question.trim();
      const answer = picked.answer.trim();

      if (!question || !answer) {
        if (row.some(cell => cell.value.trim() !== '')) skipped++;
        return;
      }

      // Doppelte Fragen bekommen unterschiedliche IDs, sonst würde eine davon
      // den Lernstatus der anderen mitziehen.
      const base = hash(question);
      seen[base] = (seen[base] || 0) + 1;
      const id = seen[base] === 1 ? base : base + '#' + seen[base];

      cards.push({ id: id, question: question, answer: answer });
    });

    return { cards: cards, skipped: skipped };
  }

  const api = { parse: parse, detectDelimiter: detectDelimiter, hash: hash };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.LernkartenCSV = api;

})(typeof window !== 'undefined' ? window : this);
