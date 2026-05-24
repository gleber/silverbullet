import { expect, test } from "vitest";
import "fake-indexeddb/auto";
import { Config } from "../config.ts";
import { EventHook } from "../plugos/hooks/event.ts";
import { DataStore } from "./datastore.ts";
import { IndexedDBKvPrimitives } from "./indexeddb_kv_primitives.ts";
import { DataStoreMQ } from "./mq.datastore.ts";
import { ObjectIndex } from "./object_index.ts";

test("ObjectIndex batchClearFileIndexes", async () => {
  const db = new IndexedDBKvPrimitives("test-index");
  await db.init();
  const ds = new DataStore(db);
  const eventHook = new EventHook();
  const config = new Config();
  const mq = new DataStoreMQ(ds, eventHook);
  const index = new ObjectIndex(ds, config, eventHook, mq);

  // Index some test pages
  await index.batchSet("page1", [
    { key: ["tag1", "id1"], value: { name: "val1" } },
    { key: ["tag2", "id2"], value: { name: "val2" } },
  ]);
  await index.batchSet("page2", [
    { key: ["tag1", "id3"], value: { name: "val3" } },
  ]);

  // Check they are indexed
  let page1Keys = [];
  for await (const { key } of ds.query({ prefix: ["ridx", "page1"] })) {
    page1Keys.push(key);
  }
  expect(page1Keys.length).toBe(2);

  let idxKeys = [];
  for await (const { key } of ds.query({ prefix: ["idx"] })) {
    idxKeys.push(key);
  }
  // 3 indexed values
  expect(idxKeys.length).toBe(3);

  // Now clear both pages using batchClearFileIndexes (passing .md to test stripping)
  await index.batchClearFileIndexes(["page1.md", "page2.md"]);

  // Check page1 keys are gone
  page1Keys = [];
  for await (const { key } of ds.query({ prefix: ["ridx", "page1"] })) {
    page1Keys.push(key);
  }
  expect(page1Keys.length).toBe(0);

  // Check idx keys are gone
  idxKeys = [];
  for await (const { key } of ds.query({ prefix: ["idx"] })) {
    idxKeys.push(key);
  }
  expect(idxKeys.length).toBe(0);

  db.close();
});

test("ObjectIndex isSyncCandidate with BootConfig fallback", async () => {
  const db = new IndexedDBKvPrimitives("test-index-sync");
  await db.init();
  const ds = new DataStore(db);
  const eventHook = new EventHook();
  const config = new Config(); // empty config
  const mq = new DataStoreMQ(ds, eventHook);
  const bootConfig = {
    spaceFolderPath: "",
    indexPage: "index",
    readOnly: false,
    enableClientEncryption: false,
    syncIgnore: "drive/**\ngmail/**",
    syncDocuments: false,
  };
  const index = new ObjectIndex(ds, config, eventHook, mq, true, bootConfig);

  expect(index.isSyncCandidate("index.md")).toBe(true);
  expect(index.isSyncCandidate("drive/photo.md")).toBe(false);
  expect(index.isSyncCandidate("gmail/email.md")).toBe(false);
  expect(index.isSyncCandidate("drive/photo.plug.js")).toBe(true); // .plug.js is always synced
  expect(index.isSyncCandidate("Library/Std/APIs/Action Button.md")).toBe(true); // Library/Std/ is always synced

  // Now configure the client config, which should override the bootConfig fallback
  config.set("sync.ignore", ["gmail/**", "Library/**"]);
  expect(index.isSyncCandidate("drive/photo.md")).toBe(true); // no longer ignored by config
  expect(index.isSyncCandidate("gmail/email.md")).toBe(false); // still ignored by config
  expect(index.isSyncCandidate("Library/Std/APIs/Action Button.md")).toBe(true); // Library/Std/ still synced despite ignore rule

  db.close();
});

test("ObjectIndex reindexSpace re-entrancy protection", async () => {
  const db = new IndexedDBKvPrimitives("test-index-reentrancy");
  await db.init();
  const ds = new DataStore(db);
  const eventHook = new EventHook();
  const config = new Config();
  const mq = new DataStoreMQ(ds, eventHook);
  mq.awaitEmptyQueue = async () => {};
  const index = new ObjectIndex(ds, config, eventHook, mq);

  // We mock a Space object with deduplicatedFileList
  const mockSpace = {
    deduplicatedFileList: async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return [{ name: "page1.md" }, { name: "page2.md" }];
    },
  } as any;

  // Let's call reindexSpace concurrently twice
  const p1 = index.reindexSpace(mockSpace);
  const p2 = index.reindexSpace(mockSpace);

  // Both promises should resolve to the same result
  await Promise.all([p1, p2]);

  // Let's verify that the index actually completed
  expect(await index.hasFullIndexCompleted()).toBe(true);

  db.close();
});

