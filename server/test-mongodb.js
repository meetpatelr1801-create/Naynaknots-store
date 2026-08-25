import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import { MongoClient } from "mongodb";
import "dotenv/config";

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("❌ MONGODB_URI is missing from .env");
  process.exit(1);
}

const client = new MongoClient(uri);

try {
  await client.connect();

  await client.db("admin").command({ ping: 1 });

  console.log("✅ MongoDB Atlas connected successfully!");

  await client.close();
} catch (error) {
  console.error("❌ MongoDB connection failed:");
  console.error(error.message);
  process.exit(1);
}