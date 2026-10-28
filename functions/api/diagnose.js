export async function onRequestPost({ request, env }) {
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });

  if (!env.OPENAI_API_KEY) {
    return json({
      error: "AI_NOT_CONFIGURED",
      message: "La diagnosi AI non è ancora configurata sul server.",
    }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_JSON", message: "Richiesta non valida." }, 400);
  }

  const category = String(body.category || "").slice(0, 80);
  const mode = body.mode === "pro" ? "professionista" : "principiante";
  const problem = String(body.problem || "").trim().slice(0, 5000);
  const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";

  if (!problem && !imageDataUrl) {
    return json({ error: "MISSING_INPUT", message: "Descrivi il problema oppure carica una foto." }, 400);
  }

  const content = [{
    type: "input_text",
    text: `Sei TIP-TOP, assistente per la diagnosi tecnica preliminare. Settore scelto: ${category || "non specificato"}. Livello: ${mode}.
Descrizione dell'utente: ${problem || "Nessuna descrizione: valuta soltanto ciò che è chiaramente visibile nella foto."}

Rispondi in italiano, in modo strutturato e prudente, usando queste sezioni:
1. Sintesi del sintomo (distingui fatti osservati e ipotesi)
2. Cause possibili ordinate per probabilità, spiegando l'incertezza
3. Controlli sicuri, passo per passo, adatti al livello selezionato
4. Cosa osservare e quali informazioni raccogliere
5. Quando fermarsi e chiamare un tecnico
6. Domande mirate per restringere le cause

Non inventare codici, misure, componenti o dettagli non forniti. Non dichiarare una diagnosi certa da una sola foto. Per elettricità, macchinari, gas, pressione, refrigeranti o altri rischi, non guidare persone non qualificate in operazioni pericolose: raccomanda isolamento delle energie e un professionista qualificato. Se l'immagine non consente di identificare il problema, dillo chiaramente.`
  }];

  if (imageDataUrl) {
    const match = imageDataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
      return json({ error: "INVALID_IMAGE", message: "Formato immagine non supportato. Usa JPG, PNG o WEBP." }, 400);
    }
    if (imageDataUrl.length > 5_500_000) {
      return json({ error: "IMAGE_TOO_LARGE", message: "La foto è troppo grande. Scegli un'immagine più piccola." }, 413);
    }
    content.push({ type: "input_image", image_url: imageDataUrl, detail: "auto" });
  }

  let upstream;
  try {
    upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-4.1-mini",
        input: [{ role: "user", content }],
        max_output_tokens: 1200,
      }),
    });
  } catch {
    return json({ error: "AI_UNAVAILABLE", message: "Servizio AI non raggiungibile. Riprova più tardi." }, 502);
  }

  if (!upstream.ok) {
    // Never return upstream details or credentials to the browser.
    return json({
      error: "AI_REQUEST_FAILED",
      message: upstream.status === 401
        ? "La configurazione AI del server non è valida."
        : "La diagnosi AI non è riuscita. Riprova più tardi.",
    }, 502);
  }

  let result;
  try {
    result = await upstream.json();
  } catch {
    return json({ error: "AI_BAD_RESPONSE", message: "Risposta AI non valida." }, 502);
  }

  const answer = (result.output || [])
    .flatMap(item => item.content || [])
    .filter(item => item.type === "output_text")
    .map(item => item.text)
    .join("\n")
    .trim();

  if (!answer) {
    return json({ error: "AI_EMPTY_RESPONSE", message: "Non è stato possibile generare una risposta utile." }, 502);
  }

  return json({ answer });
}
