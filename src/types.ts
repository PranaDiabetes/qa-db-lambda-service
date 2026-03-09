import { Document, Filter, OptionalUnlessRequiredId, UpdateFilter, WithId } from 'mongodb';

export type Action = 'query' | 'insert' | 'insertMany' | 'update' | 'delete' | 'aggregate' | 'healthcheck';

export interface LambdaEvent {
  action: Action;
  collection?: string;
  filter?: Filter<Document>;
  data?: OptionalUnlessRequiredId<Document> | OptionalUnlessRequiredId<Document>[];
  update?: UpdateFilter<Document>;
  pipeline?: Document[];
  options?: Record<string, unknown>;
}

export interface LambdaResponse {
  statusCode: number;
  body: string;
}

export interface QueryResult {
  documents: WithId<Document>[];
  count: number;
}

export interface InsertResult {
  insertedId?: string;
  insertedIds?: string[];
  insertedCount: number;
}

export interface UpdateResult {
  matchedCount: number;
  modifiedCount: number;
}

export interface DeleteResult {
  deletedCount: number;
}

export interface AggregateResult {
  documents: Document[];
  count: number;
}

export interface HealthcheckResult {
  status: 'ok' | 'error';
  message: string;
}
