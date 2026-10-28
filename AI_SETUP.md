# Collegare la diagnosi AI di TIP-TOP

Il file `functions/api/diagnose.js` è una funzione server-side per Cloudflare Pages Functions. **Non viene eseguito da GitHub Pages**: GitHub Pages serve solo file statici.

## Passi per attivarla

1. In Cloudflare crea un progetto Pages collegando il repository GitHub `ermenkov75-dotcom/Tip--Top-`.
2. Imposta la cartella di build sulla radice del repository e lascia vuoto il comando di build per questo sito statico.
3. In Cloudflare Pages apri **Settings → Variables and Secrets** e aggiungi il secret `OPENAI_API_KEY` con una chiave API OpenAI valida.
4. Facoltativamente aggiungi la variabile `OPENAI_MODEL` (default: `gpt-4.1-mini`).
5. Distribuisci il progetto e verifica che `/api/diagnose` risponda solo alle richieste POST.

## Sicurezza e costi

- Non mettere mai la chiave API nel file HTML, nel JavaScript del browser o in GitHub.
- L'uso dell'API OpenAI può generare costi separati dal piano ChatGPT; imposta limiti e monitoraggio del budget nel provider.
- Prima del lancio pubblico aggiungi limiti di frequenza, protezione anti-abuso e controlli di dimensione delle richieste.
- La risposta AI è una valutazione preliminare, non una diagnosi tecnica certificata. Le istruzioni devono rispettare le procedure del costruttore e la sicurezza.

## Stato attuale

Questo endpoint è solo il componente server-side. Il sito attuale su GitHub Pages continua a mostrare il prototipo finché il frontend non viene collegato a `POST /api/diagnose` e il progetto non viene pubblicato su un host che esegue Pages Functions.
