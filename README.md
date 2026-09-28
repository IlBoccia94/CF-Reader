# CF Reader

Demo web mobile-first per leggere un **codice fiscale italiano** da una foto di una tessera sanitaria o di un altro documento.

## Come funziona

1. L'utente scatta una foto oppure carica un'immagine.
2. L'immagine viene preprocessata nel browser.
3. [Tesseract.js](https://tesseract.projectnaptha.com/) esegue l'OCR lato client.
4. La demo cerca stringhe compatibili con la struttura del codice fiscale.
5. I candidati vengono verificati tramite il **carattere di controllo** ufficiale del codice fiscale.
6. Il primo codice fiscale valido rilevato viene mostrato e può essere copiato.

## Privacy

La demo non dispone di backend e non salva le immagini. L'elaborazione OCR avviene nel browser dell'utente. Le librerie e i dati OCR di Tesseract.js vengono caricati da CDN.

> Per un prodotto reale destinato a trattare documenti personali vanno comunque valutati requisiti privacy, sicurezza, consenso, conservazione dei dati e informative applicabili.

## Avvio

È un'app statica: basta aprire `index.html` attraverso un web server oppure pubblicare il branch con GitHub Pages.

## Limiti della demo

- OCR sensibile a sfocatura, riflessi, prospettiva e illuminazione.
- Non legge il chip NFC della tessera sanitaria.
- Non interroga l'Anagrafe Tributaria e non certifica che il codice appartenga davvero alla persona fotografata.
- Se nell'immagine sono presenti più codici fiscali validi, mostra il primo trovato.

## Struttura

- `index.html` – interfaccia
- `styles.css` – layout e stile
- `app.js` – OCR, estrazione e validazione
