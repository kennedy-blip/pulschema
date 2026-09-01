import type { JsonSchema, SchemaObject } from "./schema";

type Token = { value: string; offset: number; kind: "word" | "string" | "number" | "regex" | "symbol" };
type ParsedNode = { schema: JsonSchema; optional: boolean };
const supportedMethods = new Set(["optional", "nullable", "nullish", "default", "describe", "strict", "passthrough", "partial", "array", "or", "and", "int", "email", "url", "uuid", "datetime", "positive", "nonnegative", "negative", "nonpositive", "gt", "lt", "multipleOf", "step", "regex", "min", "max", "gte", "lte", "length", "nonempty", "readonly"]);

export class ZodParseError extends Error {
  offset: number;

  constructor(message: string, offset: number) {
    super(message);
    this.offset = offset;
  }
}

function tokenize(source: string, start: number): Token[] {
  const tokens: Token[] = [];
  const pattern = /\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/(?:\\.|[^/\\\n])+\/[a-z]*|-?\d+(?:\.\d+)?|[A-Za-z_$][\w$]*|./gy;
  pattern.lastIndex = start;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const value = match[0];
    if (/^\s/.test(value) || value.startsWith("//") || value.startsWith("/*")) continue;
    const kind = value.startsWith('"') || value.startsWith("'")
      ? "string"
      : value.startsWith("/") ? "regex"
      : /^-?\d/.test(value)
        ? "number"
        : /^[A-Za-z_$]/.test(value) ? "word" : "symbol";
    tokens.push({ value, offset: match.index, kind });
  }
  return tokens;
}

class ZodParser {
  private position = 0;

  constructor(private tokens: Token[], private endOffset: number) {}

  private current() {
    return this.tokens[this.position];
  }

  private take(value?: string) {
    const token = this.current();
    if (!token || (value !== undefined && token.value !== value)) {
      throw new ZodParseError(`Expected ${value ?? "a value"}${token ? `, found '${token.value}'` : ""}.`, token?.offset ?? this.endOffset);
    }
    this.position += 1;
    return token;
  }

  private maybe(value: string) {
    if (this.current()?.value !== value) return false;
    this.position += 1;
    return true;
  }

  private literal(): string | number | boolean | null {
    const token = this.take();
    if (token.kind === "string") {
      if (token.value.startsWith('"')) {
        try { return JSON.parse(token.value) as string; } catch { throw new ZodParseError("Invalid string literal.", token.offset); }
      }
      return token.value.slice(1, -1).replace(/\\(['\\])/g, "$1");
    }
    if (token.kind === "number") return Number(token.value);
    if (token.value === "true") return true;
    if (token.value === "false") return false;
    if (token.value === "null") return null;
    throw new ZodParseError("Expected a string, number, boolean, or null.", token.offset);
  }

  private object(): SchemaObject {
    this.take("{");
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];
    while (this.current() && this.current().value !== "}") {
      const key = this.take();
      if (key.kind !== "word" && key.kind !== "string") throw new ZodParseError("Expected a property name.", key.offset);
      const name = key.kind === "string" ? key.value.slice(1, -1) : key.value;
      this.take(":");
      const child = this.expression();
      properties[name] = child.schema;
      if (!child.optional) required.push(name);
      if (!this.maybe(",")) break;
    }
    this.take("}");
    return { type: "object", properties, required };
  }

  expression(): ParsedNode {
    this.take("z");
    this.take(".");
    const kind = this.take();
    this.take("(");
    let node: ParsedNode = { schema: {}, optional: false };

    switch (kind.value) {
      case "object": node.schema = this.object(); break;
      case "string": node.schema = { type: "string" }; break;
      case "number": node.schema = { type: "number" }; break;
      case "boolean": node.schema = { type: "boolean" }; break;
      case "date": node.schema = { type: "string", format: "date-time" }; break;
      case "null": node.schema = { type: "null" }; break;
      case "any":
      case "unknown": node.schema = {}; break;
      case "literal": node.schema = { const: this.literal() }; break;
      case "array": node.schema = { type: "array", items: this.expression().schema }; break;
      case "optional": node = { ...this.expression(), optional: true }; break;
      case "nullable": node.schema = { anyOf: [this.expression().schema, { type: "null" }] }; break;
      case "enum": {
        this.take("[");
        const values: (string | number | boolean | null)[] = [];
        while (this.current() && this.current().value !== "]") {
          values.push(this.literal());
          if (!this.maybe(",")) break;
        }
        this.take("]");
        node.schema = { enum: values };
        break;
      }
      case "union": {
        this.take("[");
        const alternatives: JsonSchema[] = [];
        while (this.current() && this.current().value !== "]") {
          alternatives.push(this.expression().schema);
          if (!this.maybe(",")) break;
        }
        this.take("]");
        node.schema = { anyOf: alternatives };
        break;
      }
      case "record": {
        const first = this.expression();
        const value = this.maybe(",") ? this.expression() : first;
        node.schema = { type: "object", additionalProperties: value.schema };
        break;
      }
      default: throw new ZodParseError(`Unsupported Zod type 'z.${kind.value}'.`, kind.offset);
    }
    this.take(")");

    while (this.maybe(".")) {
      const method = this.take();
      if (!supportedMethods.has(method.value)) throw new ZodParseError(`Unsupported Zod method '.${method.value}()'. Custom code is not executed.`, method.offset);
      this.take("(");
      let argument: string | number | boolean | null | undefined;
      let expressionArgument: ParsedNode | undefined;
      let regexArgument: Token | undefined;
      if (this.current()?.value !== ")") {
        if (method.value === "or" || method.value === "and") expressionArgument = this.expression();
        else if (method.value === "regex") regexArgument = this.take();
        else argument = this.literal();
        if (this.maybe(",")) this.literal();
      }
      this.take(")");
      const schema = node.schema as SchemaObject;
      switch (method.value) {
        case "optional": node.optional = true; break;
        case "nullable": node.schema = { anyOf: [node.schema, { type: "null" }] }; break;
        case "nullish": node = { schema: { anyOf: [node.schema, { type: "null" }] }, optional: true }; break;
        case "default": schema.default = argument; node.optional = true; break;
        case "describe": schema.description = String(argument); break;
        case "strict": schema.additionalProperties = false; break;
        case "passthrough": schema.additionalProperties = true; break;
        case "partial": schema.required = []; break;
        case "array": node = { schema: { type: "array", items: node.schema }, optional: false }; break;
        case "or":
        case "and": {
          if (!expressionArgument) throw new ZodParseError(`.${method.value}() needs a Zod schema.`, method.offset);
          node.schema = method.value === "or" ? { anyOf: [node.schema, expressionArgument.schema] } : { allOf: [node.schema, expressionArgument.schema] };
          break;
        }
        case "int": schema.type = "integer"; break;
        case "email": schema.format = "email"; break;
        case "url": schema.format = "uri"; break;
        case "uuid": schema.format = "uuid"; break;
        case "datetime": schema.format = "date-time"; break;
        case "positive": schema.exclusiveMinimum = 0; break;
        case "nonnegative": schema.minimum = 0; break;
        case "negative": schema.exclusiveMaximum = 0; break;
        case "nonpositive": schema.maximum = 0; break;
        case "gt":
        case "lt":
        case "multipleOf":
        case "step": {
          if (typeof argument !== "number") throw new ZodParseError(`.${method.value}() needs a number.`, method.offset);
          schema[method.value === "gt" ? "exclusiveMinimum" : method.value === "lt" ? "exclusiveMaximum" : "multipleOf"] = argument;
          break;
        }
        case "regex": {
          if (!regexArgument || regexArgument.kind !== "regex") throw new ZodParseError(".regex() needs a regular expression literal.", method.offset);
          const lastSlash = regexArgument.value.lastIndexOf("/");
          const flags = regexArgument.value.slice(lastSlash + 1);
          if (flags && flags !== "u") throw new ZodParseError("Regular expression flags other than 'u' are not supported.", regexArgument.offset);
          schema.pattern = regexArgument.value.slice(1, lastSlash);
          break;
        }
        case "min":
        case "max":
        case "gte":
        case "lte":
        case "length": {
          if (typeof argument !== "number") throw new ZodParseError(`.${method.value}() needs a number.`, method.offset);
          const minimum = schema.type === "string" ? "minLength" : schema.type === "array" ? "minItems" : "minimum";
          const maximum = schema.type === "string" ? "maxLength" : schema.type === "array" ? "maxItems" : "maximum";
          if (!["max", "lte"].includes(method.value)) schema[minimum] = argument;
          if (!["min", "gte"].includes(method.value)) schema[maximum] = argument;
          break;
        }
        case "nonempty": schema[schema.type === "array" ? "minItems" : "minLength"] = 1; break;
        case "readonly": break;
        default: throw new ZodParseError(`Unsupported Zod method '.${method.value}()'.`, method.offset);
      }
    }
    return node;
  }
}

// Parse a useful Zod subset without evaluating code from the editor.
export function zodToJsonSchema(source: string): JsonSchema {
  const tokens = tokenize(source, 0);
  const start = tokens.findIndex((token, index) => token.value === "z" && tokens[index + 1]?.value === "." && tokens[index - 1]?.value !== ".");
  if (start === -1) throw new ZodParseError("Expected a Zod definition such as z.object({...}).", 0);
  return new ZodParser(tokens.slice(start), source.length).expression().schema;
}