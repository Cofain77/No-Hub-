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

**Der Hauptscreen scrollt nicht.** Er ist fest auf ein iPhone 13 zugeschnitten, in der
Schriftgröße der ursprünglichen Vorlage — großer Zähler, große Statistik, große Card-Texte.
Zieht man trotzdem am Screen, gibt er ein kleines Stück elastisch nach und federt beim
Loslassen zurück in die Mitte — bewusst wenig empfindlich, damit ein normaler Tap nie
versehentlich als Ziehen zählt. Nur der *More*-Screen und einzelne lange Listen (die volle
Impuls-Liste, das Sheet) scrollen echt, weil ihr Inhalt von Natur aus unterschiedlich lang ist.

Eine bewusste Abweichung von der Vorlage: Eine Vorschau der heutigen Impulse hat auf dem
Hauptscreen keinen Platz mehr, ohne die große Schrift wieder zu verkleinern. Alle Impulse —
auch die von heute — stehen weiterhin vollständig unter *More → Impulse*.

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

**Impuls erfassen.** Das **+** unter dem Shield-Balken öffnet ein Fenster mit:

| Feld | Skala | Verhalten |
|---|---|---|
| Datum | — | vorbelegt mit dem Gerätedatum, zeigt *Heute* / *Gestern* / `TT.MM.JJ`, per Tap änderbar |
| Zeit | — | vorbelegt mit der Gerätezeit, per Tap änderbar |
| Verlangen | 0–10 | wie stark der Drang war |
| Stress | 0–10 | Anspannung unmittelbar davor |
| Stimmung | 1–5 | Laune unmittelbar davor |
| Schlaf, Stunden | 0–12 h | letzte Nacht, in Halbstundenschritten |
| Schlaf, Qualität | 1–5 | letzte Nacht |
| Allein | ja/nein | — |
| Nachgegeben | ja/nein | ob es beim Impuls geblieben ist |
| Notiz | — | bewusst klein, ein bis drei Wörter genügen |

**Alle Regler laufen in dieselbe Richtung: links grün = gut, rechts rot = schlecht.** Dadurch
muss man im Moment des Erfassens nie überlegen, wo „besser" liegt. Das gilt auch für
*Stimmung* und *Schlafqualität* — dort bedeutet also **1 = gut** und **5 = schlecht**, anders
als man es von „Score" oder „Qualität" sonst kennt. Einzige Ausnahme ist die Schlafdauer: dort
sind viele Stunden das Gute, deshalb dreht sich nur der Farbverlauf um, die Zahl bleibt
selbsterklärend.

Jeder Regler hat einen sinnvollen Startwert — wer nichts anfasst, kann direkt speichern.
Die beiden Schlafwerte beziehen sich auf die letzte Nacht und sind daher für alle Impulse
desselben Tages gleich: ab dem zweiten Eintrag am selben Tag werden sie automatisch
übernommen, statt sie erneut einzustellen.

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
streak_days, craving_intensity, sleep_hours, sleep_quality, mood_score,
stress_level, alone, gave_in, note, created_at, exported_at
```

| Spalte | Bedeutung |
|---|---|
| `weekday_num` | 1 = Montag … 7 = Sonntag |
| `hour`, `minute` | Uhrzeit als Zahl, für Zeitreihen direkt rechenbar |
| `streak_days` | der wievielte Tag des damaligen Streaks (0 = Starttag) |
| `craving_intensity` | 0–10, **0 = kein Verlangen**, 10 = übermächtig |
| `sleep_hours` | Stunden der letzten Nacht, z. B. `5.5` |
| `sleep_quality` | 1–5, **1 = erholt**, 5 = zerschlagen |
| `mood_score` | 1–5, **1 = gute Stimmung**, 5 = schlechte |
| `stress_level` | 0–10, **0 = entspannt**, 10 = am Limit |
| `alone` | 0 = nein, 1 = ja |
| `gave_in` | 0 = beim Impuls geblieben, 1 = nachgegeben |

`weekday_num` und `hour` liegen bewusst als eigene Spalten vor: damit lässt sich ohne
Vorverarbeitung eine Heatmap Wochentag × Stunde bauen und die gefährlichste Tageszeit ablesen.

`streak_days` beantwortet, ob Impulse sich eher am Anfang eines Streaks häufen (klassisch: erste
Woche) oder erst nach längerer Zeit auftreten. Die Spalte bleibt leer, wenn zum Zeitpunkt des
Impulses kein Streak lief — etwa in der Pause zwischen einem beendeten und einem neu gestarteten.

`gave_in` ist die eigentliche Zielgröße jeder Auswertung: erst damit lässt sich trennen, welche
Bedingungen bloß ein Verlangen erzeugen und welche tatsächlich zum Rückfall führen. Ohne diese
Spalte korrelieren alle anderen Werte nur mit sich selbst.

**Wichtig für die Auswertung:** In `mood_score` und `sleep_quality` bedeutet **1 = gut**, nicht
5. Das folgt der einheitlichen Reglerrichtung in der App (links grün = gut) und ist bewusst
gegen die übliche Lesart von „Score" und „Qualität" gesetzt. Wer die Daten einer KI vorlegt,
sollte das dazusagen — sonst dreht sie die Interpretation um.

Leere Zellen heißen „nicht erfasst", nicht „null". Einträge aus der Zeit vor diesen Feldern
bleiben daher in den neuen Spalten leer, statt fälschlich als 0 zu gelten.

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
