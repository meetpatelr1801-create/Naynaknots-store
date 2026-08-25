import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import { MongoClient } from "mongodb";
import fs from "fs";
import "dotenv/config";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "naynaknots";

if (!uri) {
  console.error("❌ MONGODB_URI is missing from .env");
  process.exit(1);
}

const data = JSON.parse(
  fs.readFileSync("./server/data.json", "utf8")
);

const client = new MongoClient(uri);

try {
  await client.connect();

  const db = client.db(dbName);

  console.log("✅ Connected to MongoDB");

  const collections = [
    "users",
    "products",
    "orders",
    "wishlists",
    "custom_orders",
    "messages"
  ];

  for (const name of collections) {
    try {
      await db.createCollection(name);
      console.log(`✅ Created collection: ${name}`);
    } catch (error) {
      if (error.codeName !== "NamespaceExists") {
        throw error;
      }
    }
  }

  const mapping = {
    users: data.users || [],
    products: data.products || [],
    orders: data.orders || [],
    wishlists: data.wishlists || [],
    custom_orders: data.customOrders || [],
    messages: data.messages || []
  };

  for (const [collectionName, records] of Object.entries(mapping)) {
    const collection = db.collection(collectionName);

    if (records.length === 0) {
      console.log(`ℹ️ ${collectionName}: no records`);
      continue;
    }

    await collection.deleteMany({});
    await collection.insertMany(records);

    console.log(
      `✅ ${collectionName}: ${records.length} records imported`
    );
  }

  console.log("\n🎉 Migration completed successfully!");

} catch (error) {
  console.error("❌ Migration failed:");
  console.error(error);
  process.exit(1);
} finally {
  await client.close();
}