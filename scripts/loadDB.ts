import { DataAPIClient } from "@datastax/astra-db-ts";
import { PuppeteerWebBaseLoader } from "langchain/document_loaders/web/puppeteer";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import ollama from "ollama";
import fs from "fs";
import pdf from "pdf-parse/lib/pdf-parse.js";
import "dotenv/config";

type SimilarityMetrics = "cosine" | "dot_product" | "euclidean";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
} = process.env;

const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "bge-m3";
const DIMENSION = 1024; // bge-m3 output size

const webPages = [
  "https://biginformatique.com",
  "https://biginformatique.com/soci%C3%A9t%C3%A9/qui-sommes-nous",
];
const pdfFiles = [
  "/home/abdallah/Downloads/ilide.info-manuel-d-utilisation-biggt-v1-pr_fd79489640c5f5e74dc97043d45eb219.pdf",
];

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN!);
const db = client.db(ASTRA_DB_API_ENDPOINT!, { namespace: ASTRA_DB_NAMESPACE });

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 800,
  chunkOverlap: 100,
});

// Drops the old collection (1536 dims) and creates a new one (1024 dims)
const createCollection = async (metric: SimilarityMetrics = "cosine") => {
  try {
    await db.dropCollection(ASTRA_DB_COLLECTION!);
    console.log("Old collection dropped");
  } catch {
    console.log("No old collection to drop");
  }
  const res = await db.createCollection(ASTRA_DB_COLLECTION!, {
    vector: { dimension: DIMENSION, metric },
  });
  console.log("Collection created:", res);
};

const scrapePage = async (url: string) => {
  const loader = new PuppeteerWebBaseLoader(url, {
    launchOptions: { headless: true },
    gotoOptions: { waitUntil: "domcontentloaded" },
    evaluate: async (page, browser) => {
      const result = await page.evaluate(() => document.body.innerText);
      await browser.close();
      return result;
    },
  });
  return (await loader.scrape())?.replace(/<[^>]*>?/gm, "");
};

const readPdf = async (path: string) => {
  const data = await pdf(fs.readFileSync(path));
  console.log(
    `PDF read: ${data.numpages} pages, ${data.text.length} characters`,
  );
  return data.text;
};

const loadData = async () => {
  const collection = db.collection(ASTRA_DB_COLLECTION!);

  const sources: { name: string; getText: () => Promise<string> }[] = [
    ...webPages.map((u) => ({ name: u, getText: () => scrapePage(u) })),
    ...pdfFiles.map((p) => ({ name: p, getText: () => readPdf(p) })),
  ];

  for (const source of sources) {
    console.log("Loading:", source.name);
    const content = (await source.getText()) || "";
    if (content.trim().length < 50) {
      console.log(
        "  Skipped: almost no text found (scanned PDF or blocked page?)",
      );
      continue;
    }

    const chunks = await splitter.splitText(content);
    console.log(`  ${chunks.length} chunks`);

    const batchSize = 16;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      // one Ollama call embeds the whole batch
      const emb = await ollama.embed({ model: EMBED_MODEL, input: batch });

      const docs = batch.map((text, j) => ({
        $vector: emb.embeddings[j],
        text,
        source: source.name,
      }));

      await collection.insertMany(docs);
      console.log(
        `  inserted ${Math.min(i + batchSize, chunks.length)}/${chunks.length}`,
      );
    }
  }
  console.log("Done");
};

createCollection().then(loadData).catch(console.error);
