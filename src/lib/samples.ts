export const SAMPLE_SCHEMA = `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "User",
  "type": "object",
  "required": ["id", "name", "email", "role"],
  "properties": {
    "id": { "type": "integer", "minimum": 1 },
    "name": { "type": "string", "minLength": 2 },
    "email": { "type": "string", "format": "email" },
    "role": { "type": "string", "enum": ["admin", "editor", "viewer"] },
    "active": { "type": "boolean" },
    "tags": { "type": "array", "items": { "type": "string" } }
  },
  "additionalProperties": false
}`;

export const SAMPLE_ZOD = `import { z } from "zod";

export const userSchema = z.object({
  id: z.number().int().min(1),
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]),
  active: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
}).strict();`;

export const SAMPLE_PAYLOAD = `{
  "id": 101,
  "name": "Alex Morgan",
  "email": "alex.morgan@example.com",
  "role": "admin",
  "active": true,
  "tags": [
    "developer",
    "early-adopter"
  ]
}`;

export const SAMPLE_MODIFIED = `{
  "id": 101,
  "name": "Alex Morgan",
  "email": "alex.morgan@example.com",
  "role": "editor",
  "active": true,
  "tags": [
    "developer",
    "early-adopter",
    "beta-tester"
  ],
  "verified": true
}`;

export const MOCK_SCHEMAS: Record<string, string> = {
  users: SAMPLE_SCHEMA,
  transactions: `{
  "title": "Transaction",
  "type": "object",
  "required": ["id", "customer", "amount", "currency", "status"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "customer": { "type": "string" },
    "amount": { "type": "number", "minimum": 5, "maximum": 500 },
    "currency": { "type": "string", "enum": ["USD", "EUR", "GBP"] },
    "status": { "type": "string", "enum": ["paid", "pending", "refunded"] },
    "createdAt": { "type": "string", "format": "date-time" }
  },
  "additionalProperties": false
}`,
  iot: `{
  "title": "SensorReading",
  "type": "object",
  "required": ["deviceId", "temperature", "humidity", "timestamp"],
  "properties": {
    "deviceId": { "type": "string", "format": "uuid" },
    "temperature": { "type": "number", "minimum": 15, "maximum": 35 },
    "humidity": { "type": "integer", "minimum": 20, "maximum": 80 },
    "status": { "type": "string", "enum": ["online", "offline"] },
    "timestamp": { "type": "string", "format": "date-time" }
  },
  "additionalProperties": false
}`,
};