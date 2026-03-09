import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;

/**
 * Returns a cached MongoDB client, creating one if it does not already exist.
 * Reusing the connection across Lambda invocations avoids the overhead of
 * creating a new connection on every request.
 */
export async function getMongoClient(): Promise<MongoClient> {
  if (client) {
    return client;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  });

  await client.connect();
  return client;
}

/**
 * Returns the target MongoDB database.
 * The database name is read from the DB_NAME environment variable.
 */
export async function getDatabase(): Promise<Db> {
  const dbName = process.env.DB_NAME;
  if (!dbName) {
    throw new Error('DB_NAME environment variable is not set');
  }

  const mongoClient = await getMongoClient();
  return mongoClient.db(dbName);
}

/**
 * Closes the MongoDB connection and resets the cached client.
 * Primarily useful in tests to ensure a clean state between runs.
 */
export async function closeConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
  }
}
