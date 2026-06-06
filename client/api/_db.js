// Shared MongoDB connection for the Vercel serverless functions under client/api/.
// A module-level promise keeps one client alive across warm invocations.
import { MongoClient } from "mongodb";

let clientPromise;

function getClientPromise() {
  if (!clientPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set");
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
    clientPromise = client.connect();
  }
  return clientPromise;
}

// Products live in the `test` database (Mongoose default when the URI has no db name).
export async function getProductsCollection() {
  const client = await getClientPromise();
  return client.db("test").collection("products");
}
