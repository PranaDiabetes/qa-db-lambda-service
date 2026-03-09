import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDatabase } from './db';
import {
  LambdaEvent,
  LambdaResponse,
  Action,
  QueryResult,
  InsertResult,
  UpdateResult,
  DeleteResult,
  AggregateResult,
  HealthcheckResult,
} from './types';

/**
 * Main Lambda handler entry point.
 *
 * The function accepts either a raw {@link LambdaEvent} (when invoked directly)
 * or an API Gateway proxy event (when exposed via HTTP).  The `action` field
 * drives which MongoDB operation is executed.
 *
 * Supported actions:
 *  - query       – find documents matching a filter
 *  - insert      – insert a single document
 *  - insertMany  – insert multiple documents
 *  - update      – update documents matching a filter
 *  - delete      – delete documents matching a filter
 *  - aggregate   – run an aggregation pipeline
 *  - healthcheck – verify the database connection
 */
export const handler = async (
  event: LambdaEvent | APIGatewayProxyEvent,
): Promise<LambdaResponse | APIGatewayProxyResult> => {
  try {
    const lambdaEvent = parseEvent(event);
    const result = await dispatch(lambdaEvent);
    return respond(200, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return respond(500, { error: message });
  }
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseEvent(event: LambdaEvent | APIGatewayProxyEvent): LambdaEvent {
  // API Gateway proxy events carry the payload as a JSON string in `body`.
  if ('body' in event && typeof (event as APIGatewayProxyEvent).body === 'string') {
    const body = (event as APIGatewayProxyEvent).body;
    return JSON.parse(body as string) as LambdaEvent;
  }
  return event as LambdaEvent;
}

function respond(statusCode: number, body: unknown): LambdaResponse {
  return { statusCode, body: JSON.stringify(body) };
}

async function dispatch(event: LambdaEvent): Promise<unknown> {
  const { action } = event;

  if (!action) {
    throw new Error("Missing required field: 'action'");
  }

  const handlers: Record<Action, () => Promise<unknown>> = {
    query: () => handleQuery(event),
    insert: () => handleInsert(event),
    insertMany: () => handleInsertMany(event),
    update: () => handleUpdate(event),
    delete: () => handleDelete(event),
    aggregate: () => handleAggregate(event),
    healthcheck: () => handleHealthcheck(),
  };

  const fn = handlers[action];
  if (!fn) {
    throw new Error(`Unknown action: '${action}'`);
  }

  return fn();
}

function requireCollection(event: LambdaEvent): string {
  if (!event.collection) {
    throw new Error("Missing required field: 'collection'");
  }
  return event.collection;
}

async function handleQuery(event: LambdaEvent): Promise<QueryResult> {
  const collectionName = requireCollection(event);
  const db = await getDatabase();
  const collection = db.collection(collectionName);
  const filter = event.filter ?? {};
  const options = event.options ?? {};

  const documents = await collection.find(filter, options).toArray();
  return { documents, count: documents.length };
}

async function handleInsert(event: LambdaEvent): Promise<InsertResult> {
  const collectionName = requireCollection(event);
  if (!event.data || Array.isArray(event.data)) {
    throw new Error("Field 'data' must be a single document object for 'insert'");
  }
  const db = await getDatabase();
  const result = await db.collection(collectionName).insertOne(event.data);
  return { insertedId: result.insertedId.toString(), insertedCount: 1 };
}

async function handleInsertMany(event: LambdaEvent): Promise<InsertResult> {
  const collectionName = requireCollection(event);
  if (!Array.isArray(event.data) || event.data.length === 0) {
    throw new Error("Field 'data' must be a non-empty array of documents for 'insertMany'");
  }
  const db = await getDatabase();
  const result = await db.collection(collectionName).insertMany(event.data);
  const insertedIds = Object.values(result.insertedIds).map((id) => id.toString());
  return { insertedIds, insertedCount: result.insertedCount };
}

async function handleUpdate(event: LambdaEvent): Promise<UpdateResult> {
  const collectionName = requireCollection(event);
  if (!event.update) {
    throw new Error("Missing required field: 'update'");
  }
  const db = await getDatabase();
  const filter = event.filter ?? {};
  const result = await db.collection(collectionName).updateMany(filter, event.update);
  return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
}

async function handleDelete(event: LambdaEvent): Promise<DeleteResult> {
  const collectionName = requireCollection(event);
  const db = await getDatabase();
  const filter = event.filter ?? {};
  const result = await db.collection(collectionName).deleteMany(filter);
  return { deletedCount: result.deletedCount };
}

async function handleAggregate(event: LambdaEvent): Promise<AggregateResult> {
  const collectionName = requireCollection(event);
  if (!event.pipeline || !Array.isArray(event.pipeline)) {
    throw new Error("Missing or invalid required field: 'pipeline'");
  }
  const db = await getDatabase();
  const documents = await db.collection(collectionName).aggregate(event.pipeline).toArray();
  return { documents, count: documents.length };
}

async function handleHealthcheck(): Promise<HealthcheckResult> {
  const db = await getDatabase();
  await db.command({ ping: 1 });
  return { status: 'ok', message: 'MongoDB connection is healthy' };
}
