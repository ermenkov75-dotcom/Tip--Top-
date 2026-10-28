const MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.AI || typeof env.AI.run !== "function") {
    return json({
      error: "AI_NOT_CONFIGURED",
      message: "Il collegamento AI di Cloudflare non è ancora attivo nelle impostazioni del progetto."
    }, 503);
  }

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 6_000_000) {
      return json({ error: "REQUEST_TOO_LARGE", message: "La richiesta è troppo grande. Scegli una foto più piccola." }, 413);
    }
    body = JSON.parse(raw);
  } catch {
    return json({ error: "INVALID_JSON", message: "Richiesta non valida." }, 400);
  }

  const category = typeof body.category === "string" ? body.category.trim().slice(0, 100) : "";
  const mode = body.mode === "pro" ? "professionista" : "principiante";
  const problem = typeof body.problem === "string" ? body.problem.trim().slice(0, 5000) : "";
  const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";

  if (!category || (!problem && !imageDataUrl)) {
    return json({ error: "MISSING_INPUT", message: "Scegli il settore e descrivi il problema oppure carica una foto." }, 400);
  }

  if (imageDataUrl && !/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(imageDataUrl)) {
    return json({ error: "INVALID_IMAGE", message: "Formato immagine non supportato. Usa JPG, PNG o WEBP." }, 400);
  }
  if (imageDataUrl.length > 5_600_000) {
    return json({ error: "IMAGE_TOO_LARGE", message: "La foto è troppo grande. Scegli un'immagine più piccola." }, 413);
  }

  const system = [
    "Sei TIP-TOP, un assistente per la diagnosi tecnica preliminare.",
    "Rispondi sempre in italiano, in modo chiaro, concreto e prudente.",
    "Distingui fatti osservati, ipotesi e verifiche. Non inventare dettagli, misure, codici o componenti e non dichiarare una diagnosi certa se i dati non bastano.",
    "Organizza la risposta in: 1) sintesi del problema, 2) cause possibili ordinate per probabilità e motivazione, 3) controlli sicuri passo per passo, 4) cosa osservare e come interpretarlo, 5) quando fermarsi e chiamare un tecnico, 6) fino a tre domande mirate se servono.",
    "Se è presente una foto, descrivi soltanto ciò che è chiaramente visibile. Se non basta, dillo e chiedi una foto più chiara o informazioni pertinenti.",
    "Per elettricità, gas, refrigeranti, pressione, macchinari in movimento o altri rischi, metti prima la sicurezza. Non guidare un principiante in lavori sotto tensione, bypass di protezioni o operazioni pericolose; raccomanda un tecnico qualificato quando necessario.",
    "Modalità professionista: puoi usare terminologia tecnica, ma non inventare valori o procedure specifiche senza dati sufficienti."
  ].join(" ");

  const userText = [
    "Settore: " + category,
    "Livello: " + mode,
    "Descrizione: " + (problem || "L'utente non ha scritto una descrizione. Analizza solo ciò che è realmente visibile nella foto."),
    "Fornisci controlli specifici per questo caso, non una lista generica."
  ].join("\n");

  const userContent = imageDataUrl
    ? [
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: imageDataUrl } }
      ]
    : userText;

  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent }
      ],
      max_tokens: 900,
      temperature: 0.2
    });

    const answer = typeof result?.response === "string"
      ? result.response.trim()
      : typeof result?.result === "string"
        ? result.result.trim()
        : "";

    if (!answer) {
      return json({ error: "AI_EMPTY_RESPONSE", message: "L'AI non ha restituito una risposta leggibile. Riprova." }, 502);
    }
    return json({ answer });
  } catch {
    return json({ error: "AI_REQUEST_FAILED", message: "Il servizio AI non è riuscito a completare l'analisi. Riprova più tardi." }, 502);
  }
}
