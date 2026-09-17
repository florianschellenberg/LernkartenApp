# Lernkarten App

Karteikarten im Browser: <https://florianschellenberg.github.io/LernkartenApp/>

## Ein neues Kartenset anlegen

Eine `.csv`-Datei in den Ordner [`Lernkarten/`](Lernkarten) hochladen — fertig. Der
Dateiname ist der Name des Sets (`Innere_Medizin.csv` → „Innere Medizin"), und das Set
erscheint automatisch in der Auswahlliste auf der Startseite. Es ist **kein** Eintrag in
einer Liste und keine Änderung am Code nötig.

Beim ersten Besuch ist „Transaktionsanalyse" vorausgewählt, danach immer das zuletzt
gelernte Set. Die Vorauswahl steht als `DEFAULT_DECK` oben im Skript von `index.html`.

Format: eine Karte pro Zeile, erste Spalte Frage, zweite Spalte Antwort.

```csv
Was ist HTML?,"HyperText Markup Language"
Was ist CSS?,"Cascading Style Sheets"
```

Der Parser kommt auch ohne Nacharbeit zurecht mit: Semikolon oder Tabulator als Trenner
(deutscher Excel-Export), einer Kopfzeile wie `Frage;Antwort`, BOM und Windows-Zeilenenden,
Kommas und Zeilenumbrüchen innerhalb von Anführungszeichen sowie zusätzlichen Spalten, die
einfach ignoriert werden.

## Lernstatus

Der Fortschritt wird pro Kartenset im `localStorage` des Browsers gehalten und ist an den
Fragetext gebunden — Karten in einer bestehenden Datei zu ergänzen oder umzusortieren
verliert ihn also nicht.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Die App: Set-Auswahl, Karten, Lernlogik |
| `csv-parser.js` | CSV-Parser (Trennzeichen-, Kopfzeilen-, Quoting-Erkennung) |
| `decks.js` | Findet die Sets im Ordner `Lernkarten/` |
| `Lernkarten/decks.json` | Erzeugt beim GitHub-Pages-Build die Liste der Sets |
| `test_csv_parser.html` | Format- und Datentests für den Parser |
