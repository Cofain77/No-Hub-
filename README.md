# No hub

Streak-Tracker mit Impuls-Protokoll. Läuft als installierbare Web-App (PWA) auf dem
iPhone — kein App Store, kein Entwickler-Account, keine Xcode-Signatur.

Alle Daten bleiben auf dem Gerät. Es gibt keinen Server, keinen Account, keine Telemetrie.

---

## Installation auf dem iPhone

1. Die Seite in **Safari** öffnen (nicht Chrome — nur Safari darf auf iOS installieren).
2. Teilen-Symbol → **Zum Home-Bildschirm**.
3. Die App vom Home-Bildschirm starten. Sie läuft im Vollbild ohne Safari-Leiste.

Der Schritt „Zum Home-Bildschirm" ist nicht kosmetisch: Als installierte App nimmt iOS die
Daten von der 7-Tage-Löschregel für ungenutzte Websites aus. Wer die Seite nur im Safari-Tab
lässt, riskiert nach einer Woche ohne Nutzung den Verlust.

## Veröffentlichen (einmalig)

GitHub Pages genügt und ist kostenlos. HTTPS ist Pflicht, sonst laufen Service Worker und
dauerhafter Speicher nicht.

1. Diesen Branch nach `main` mergen.
2. Repo → **Settings** → **Pages**
3. *Source*: **Deploy from a branch** → Branch `main`, Ordner `/ (root)` → **Save**
4. Nach ein bis zwei Minuten liegt die App unter
   `https://<dein-github-name>.github.io/No-Hub-/`

Diese URL in Safari öffnen und wie oben installieren.

---

## Bedienung

**Zähler.** Die große Zahl sind volle Tage seit dem Start des laufenden Streaks. Der Level
ergibt sich daraus automatisch.

**Recovery beenden.** Der Knopf *Shield Active* muss **zehnmal** getippt werden. Ab dem
ersten Tap zählt die große Zahl rückwärts von 9. Fünf Sekunden ohne Tap brechen ab. Nach dem
zehnten Tap öffnet sich *End Recovery*; der Satz

```
I understand this will reset my progress
```

muss exakt eingegeben werden. Erst dann wird der Knopf aktiv.

Beim Zurücksetzen wird der laufende Streak in *Best Streak* und *Days Shielded* verbucht.
**Impuls-Einträge werden dabei nie gelöscht.**

**Impuls erfassen.** Das **+** unter dem Shield-Balken öffnet ein Fenster auf halber
Bildschirmhöhe mit drei Feldern:

| Feld | Verhalten |
|---|---|
| Datum | vorbelegt mit dem Gerätedatum, zeigt *Heute* / *Gestern* / `TT.MM.JJ`, per Tap änderbar |
| Impuls | Auswahl des Auslösers — was gerade lief, als der Impuls kam |
| Zeit | vorbelegt mit der Gerätezeit, per Tap änderbar |

Darunter ein bewusst kleines Notizfeld — ein bis drei Wörter genügen, mehr geht trotzdem.

Der zuletzt gewählte Auslöser ist beim nächsten Mal vorausgewählt, weil sich Impulse in aller
Regel wiederholen. Die Auswahlliste steht in `assets/app.js` in der Konstante `TRIGGERS`:

```
Langeweile · Stress · Müdigkeit · Allein · Social Media
Nachts wach · Aufwachen · Frust · Einsamkeit · Sonstiges
```

Kurze Begriffe sind Absicht: Die Liste ist eine Auswertungsachse, keine Beschreibung. Wer sie
ändert, sollte das früh tun — sonst zerfällt die Zeitreihe in alte und neue Kategorien.

---

## Daten

### Was gespeichert wird

| Ort | Inhalt |
|---|---|
| IndexedDB `nohub` | Impuls-Einträge und Streak-Status — der primäre Speicher |
| localStorage | Spiegel derselben Daten, greift wenn IndexedDB blockiert ist |

Beim ersten Start fordert die App über `navigator.storage.persist()` dauerhaften Speicher an.
Unter *More → Speicher* steht, ob iOS das bestätigt hat.

### CSV-Export

*More → CSV exportieren*. Auf dem iPhone öffnet sich das Teilen-Menü, die Datei landet in
*Dateien*, iCloud oder per Mail.

**Der Export löscht nichts.** Exportierte Einträge werden lediglich mit `exported_at`
markiert, damit ersichtlich bleibt, was seit dem letzten Export dazugekommen ist. Jeder
Export enthält immer den vollständigen Bestand — auch nach Jahren.

Spalten:

```
id, date, time, iso_timestamp, weekday, weekday_num, hour, minute,
trigger, note, created_at, exported_at
```

`weekday_num` (1 = Montag) und `hour` liegen bewusst als eigene Spalten vor: damit lässt sich
ohne Vorverarbeitung eine Heatmap Wochentag × Stunde bauen und die gefährlichste Tageszeit
ablesen. `trigger` ist die zweite Auswertungsachse — sie beantwortet nicht *wann*, sondern
*woraus* der Impuls entsteht.

### Vollbackup

*More → Vollbackup (JSON)* sichert Einträge **und** Streak-Historie. Das ist die einzige echte
Absicherung, falls iOS die App-Daten doch einmal verwirft oder das Gerät wechselt. Ein Backup
pro Monat, abgelegt in iCloud, reicht.

Zurückspielen über *More → Backup wählen*. Der Import führt zusammen statt zu überschreiben;
bereits vorhandene Einträge werden anhand ihrer `id` übersprungen.

---

## Level

| Level | Name | Tage |
|---|---|---|
| 1 | Awakening | 0 |
| 2 | Standing Up | 1 |
| 3 | First Steps | 2–7 |
| 4 | Building | 8–29 |
| 5 | Clarity | 30–89 |
| 6 | Iron Will | 90+ |

Die Grenzen stehen in `assets/app.js` in der Konstante `LEVELS` und lassen sich dort samt
Beschreibungstexten anpassen.

---

## Aufbau

```
index.html                  Markup beider Screens und beider Sheets
assets/app.css              Darstellung
assets/app.js               Ablauflogik, Rendering, Export
assets/store.js             Persistenz (IndexedDB + localStorage-Spiegel)
sw.js                       Service Worker, cached nur die App — nie Nutzerdaten
manifest.webmanifest        Installationsdaten
icons/                      App-Icons
```

Kein Build-Schritt, keine Abhängigkeiten. Wer etwas ändert, erhöht in `sw.js` die
Cache-Version (`nohub-shell-vN`), damit installierte Geräte die neue Fassung ziehen.

## Lokal testen

```bash
python3 -m http.server 8099
# http://localhost:8099
```
