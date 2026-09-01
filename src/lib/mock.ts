import { faker } from "@faker-js/faker";
import { generateSync, type JsonSchema as FakerSchema } from "json-schema-faker";
import { compileSchema, type JsonSchema, type SchemaObject } from "./schema";

function addRealisticHints(input: JsonSchema, key = ""): JsonSchema {
  if (typeof input === "boolean") return input;
  const schema: SchemaObject = { ...input };
  if (schema.properties) {
    schema.properties = Object.fromEntries(Object.entries(schema.properties).map(([name, child]) => [name, addRealisticHints(child, name)]));
  }
  if (schema.items) schema.items = addRealisticHints(schema.items, key);
  for (const kind of ["anyOf", "oneOf", "allOf"] as const) {
    if (schema[kind]) schema[kind] = schema[kind]?.map((child) => addRealisticHints(child, key));
  }
  if (schema.type === "string" && !schema.faker && !schema.enum && schema.const === undefined && !schema.pattern && schema.maxLength === undefined) {
    const name = key.toLowerCase().replace(/[_-]/g, "");
    let method = "";
    if (schema.format === "email" || name === "email") method = "internet.email";
    else if (!schema.format && (name === "name" || name === "fullname" || name === "customer")) method = "person.fullName";
    else if (!schema.format && name === "firstname") method = "person.firstName";
    else if (!schema.format && name === "lastname") method = "person.lastName";
    else if (!schema.format && (name === "company" || name === "companyname")) method = "company.name";
    else if (!schema.format && name === "city") method = "location.city";
    else if (!schema.format && name === "country") method = "location.country";
    else if (!schema.format && name === "username") method = "internet.username";
    else if (!schema.format && (name === "tags" || name === "tag")) method = "lorem.word";
    if (method) schema.faker = method;
  }
  return schema;
}

export function generateMockRecords(schema: JsonSchema, count: number): unknown[] {
  const validate = compileSchema(schema);
  const enhanced = addRealisticHints(schema) as FakerSchema;
  const plain = schema as FakerSchema;
  const results: unknown[] = [];
  for (let index = 0; index < count; index++) {
    let found = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      const record = generateSync(attempt < 6 ? enhanced : plain, {
        seed: Math.floor(Math.random() * 2_000_000_000),
        alwaysFakeOptionals: true,
        maxDefaultItems: 3,
        extensions: { faker },
      });
      if (validate(record)) {
        results.push(record);
        found = true;
        break;
      }
    }
    if (!found) throw new Error("Could not generate a valid record for this schema. Check its constraints and try again.");
  }
  return results;
}