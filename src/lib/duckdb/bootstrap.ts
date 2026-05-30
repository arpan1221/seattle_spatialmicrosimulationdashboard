"use client";

import * as duckdb from "@duckdb/duckdb-wasm";

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;

/** Lazily boot a DuckDB-WASM instance. Cached for the page lifetime. */
export function getDuckDB(): Promise<duckdb.AsyncDuckDB> {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    const bundles = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(bundles);

    // The worker script lives on jsDelivr; wrap it in a Blob so the bundler
    // doesn't try to inline it.
    const workerSrc = await (await fetch(bundle.mainWorker!)).text();
    const workerBlob = new Blob([workerSrc], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(workerBlob);

    const worker = new Worker(workerUrl);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(workerUrl);
    return db;
  })();

  return dbPromise;
}
