import { DataAPIClient } from "@datastax/astra-db-ts";
import ollama from "ollama";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
} = process.env;

const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "bge-m3";
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || "llama3.2:3b";

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN!);
const db = client.db(ASTRA_DB_API_ENDPOINT!, { namespace: ASTRA_DB_NAMESPACE });

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const latestMessage = messages[messages.length - 1]?.content;

    let docContext = "";
    try {
      // EMBEDDING (replaces ai.models.embedContent)
      const emb = await ollama.embed({
        model: EMBED_MODEL,
        input: latestMessage,
      });
      const vector = emb.embeddings[0];

      const collection = db.collection(ASTRA_DB_COLLECTION!);
      const cursor = collection.find(
        {},
        {
          sort: { $vector: vector },
          limit: 4, // small model = small context, so fewer chunks
        },
      );
      const documents = await cursor.toArray();
      docContext = documents.map((d) => d.text).join("\n---\n");
    } catch (error) {
      console.log("error querying db...", error);
    }

    const system = {
      role: "system",
      content: `Tu es un assistant qui répond aux questions sur l'entreprise BIG Informatique en utilisant uniquement le contexte fourni.
Si la réponse n'est pas dans le contexte, réponds poliment que tu ne sais pas.
Réponds dans la langue de la question.
CONTEXTE:
${docContext}
FIN DU CONTEXTE`,
    };

    // GENERATION (replaces ai.models.generateContentStream)
    const response = await ollama.chat({
      model: CHAT_MODEL,
      messages: [
        system,
        ...messages.map((m: any) => ({ role: m.role, content: m.content })),
      ],
      stream: true,
      options: { num_ctx: 4096, temperature: 0.2 },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            if (chunk.message?.content) {
              controller.enqueue(encoder.encode(chunk.message.content));
            }
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error(error);
    return new Response("Something went wrong", { status: 500 });
  }
}
