import Ajv, { type AnySchema, type ErrorObject, type ValidateFunction } from "ajv";
import Ajv2019 from "ajv/dist/2019";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { findNodeAtLocation, parseTree, printParseErrorCode, type ParseError } from "jsonc-parser";
import { ZodParseError, zodToJsonSchema } from "./zodParser";

export type SchemaObject = {
  [key: string]: unknown;
  $schema?: string;
  $ref?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: boolean | JsonSchema;
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  format?: string;
  default?: unknown;
};
export type JsonSchema = SchemaObject | boolean;
export type SchemaMode = "json" | "zod";
export type Issue = { message: string; path: string; line: number; column: number };
export type ValidationResult = {
  valid: boolean;
  kind: "success" | "schema" | "payload" | "validation";
  title: string;
  description: string;
  issues: Issue[];
  schema?: JsonSchema;
  payload?: unknown;
};

const options = { allErrors: true, strict: false, addUsedSchema: false } as const;
const draft7 = new Ajv(options);
const draft2019 = new Ajv2019(options);
const draft2020 = new Ajv2020(options);
[draft7, draft2019, draft2020].forEach((instance) => addFormats(instance));

export function positionAt(text: string, offset: number) {
  const previous = text.slice(0, Math.max(0, offset));
  const lines = previous.split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

export class InputError extends Error {
  line: number;
  column: number;

  constructor(message: string, line = 1, column = 1) {
    super(message);
    this.line = line;
    this.column = column;
  }
}

const syntaxMessages: Record<string, string> = {
  PropertyNameExpected: "Expected a property name in double quotes",
  ValueExpected: "Expected a JSON value",
  ColonExpected: "Expected a colon after the property name",
  CommaExpected: "Expected a comma between values",
  CloseBraceExpected: "Expected a closing brace",
  CloseBracketExpected: "Expected a closing bracket",
  EndOfFileExpected: "Unexpected content after the JSON value",
  UnexpectedEndOfString: "Unterminated string",
  InvalidSymbol: "Unexpected character",
  InvalidCommentToken: "Comments are not allowed in JSON",
};

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const errors: ParseError[] = [];
    parseTree(text, errors, { disallowComments: true, allowTrailingComma: false });
    const first = errors[0];
    const fallbackPosition = error instanceof Error ? /position (\d+)/.exec(error.message) : null;
    const offset = first?.offset ?? (fallbackPosition ? Number(fallbackPosition[1]) : text.length);
    const position = positionAt(text, offset);
    const code = first ? printParseErrorCode(first.error) : "";
    throw new InputError(syntaxMessages[code] ?? "Invalid JSON syntax", position.line, position.column);
  }
}

export function parseSchema(text: string, mode: SchemaMode): JsonSchema {
  let parsed: unknown;
  try {
    parsed = mode === "zod" ? zodToJsonSchema(text) : parseJson(text);
  } catch (error) {
    if (error instanceof ZodParseError) {
      const position = positionAt(text, error.offset);
      throw new InputError(error.message, position.line, position.column);
    }
    throw error;
  }
  if (typeof parsed !== "boolean" && (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))) {
    throw new InputError("A schema must be a JSON object or boolean.");
  }
  return parsed as JsonSchema;
}

export function compileSchema(schema: JsonSchema): ValidateFunction {
  const version = typeof schema === "object" ? schema.$schema ?? "" : "";
  const engine = version.includes("2020-12") ? draft2020 : version.includes("2019-09") ? draft2019 : draft7;
  return engine.compile(schema as AnySchema);
}

function readablePath(path: (string | number)[]) {
  return path.reduce<string>((result, part) => typeof part === "number" ? `${result}[${part}]` : /^[A-Za-z_$][\w$]*$/.test(part) ? `${result}.${part}` : `${result}[${JSON.stringify(part)}]`, "$");
}

function issueFromAjv(error: ErrorObject, payloadText: string): Issue {
  const parts: (string | number)[] = error.instancePath.split("/").slice(1).map((part) => {
    const decoded = part.replace(/~1/g, "/").replace(/~0/g, "~");
    return /^\d+$/.test(decoded) ? Number(decoded) : decoded;
  });
  let message = error.message ?? "does not match the schema";
  if (error.keyword === "required") message = `Missing required property '${String(error.params.missingProperty)}'`;
  if (error.keyword === "additionalProperties") {
    parts.push(String(error.params.additionalProperty));
    message = `Unexpected property '${String(error.params.additionalProperty)}'`;
  }
  if (error.keyword === "format") message = `Must match format '${String(error.params.format)}'`;
  if (error.keyword === "type") message = `Must be ${String(error.params.type)}`;
  if (error.keyword === "enum") message = "Must be one of the allowed values";
  const tree = parseTree(payloadText);
  const node = tree ? findNodeAtLocation(tree, parts) : undefined;
  const offset = node ? (error.keyword === "required" ? node.offset + Math.max(0, node.length - 1) : node.offset) : 0;
  const position = positionAt(payloadText, offset);
  return { message: message.charAt(0).toUpperCase() + message.slice(1), path: readablePath(parts), ...position };
}

export function validateDocuments(schemaText: string, mode: SchemaMode, payloadText: string): ValidationResult {
  let schema: JsonSchema;
  try {
    schema = parseSchema(schemaText, mode);
  } catch (error) {
    const issue = error instanceof InputError ? error : new InputError(error instanceof Error ? error.message : "Invalid schema");
    return { valid: false, kind: "schema", title: "Schema syntax error", description: `${issue.message} at line ${issue.line}, column ${issue.column}.`, issues: [{ message: issue.message, path: "Schema", line: issue.line, column: issue.column }] };
  }

  let validate: ValidateFunction;
  try {
    validate = compileSchema(schema);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The schema could not be compiled";
    return { valid: false, kind: "schema", title: "Invalid schema definition", description: message, issues: [{ message, path: "Schema", line: 1, column: 1 }], schema };
  }

  let payload: unknown;
  try {
    payload = parseJson(payloadText);
  } catch (error) {
    const issue = error instanceof InputError ? error : new InputError("Invalid JSON syntax");
    return { valid: false, kind: "payload", title: "Payload syntax error", description: `${issue.message} at line ${issue.line}, column ${issue.column}.`, issues: [{ message: issue.message, path: "Payload", line: issue.line, column: issue.column }], schema };
  }

  if (validate(payload)) {
    return { valid: true, kind: "success", title: "Valid JSON payload", description: "Your JSON payload conforms to the schema. Nice work!", issues: [], schema, payload };
  }
  const issues = (validate.errors ?? []).map((error) => issueFromAjv(error, payloadText));
  const first = issues[0];
  return { valid: false, kind: "validation", title: "Validation failed", description: first ? `${first.message} at line ${first.line}.` : "Your payload does not match the schema.", issues, schema, payload };
}