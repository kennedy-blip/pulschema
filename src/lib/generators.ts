import type { JsonSchema, SchemaObject } from "./schema";

const objectSchema = (schema: JsonSchema): SchemaObject | undefined => typeof schema === "object" && schema !== null ? schema : undefined;
const isObjectSchema = (schema: SchemaObject) => schema.type === "object" || Boolean(schema.properties);
const pascal = (value: string) => {
  const result = value.replace(/([a-z\d])([A-Z])/g, "$1 $2").split(/[^A-Za-z\d]+/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join("");
  return !result ? "Generated" : /^\d/.test(result) || ["True", "False", "None"].includes(result) ? `Type${result}` : result;
};
const propertyName = (value: string) => /^[A-Za-z_$][\w$]*$/.test(value) ? value : JSON.stringify(value);
const singular = (value: string) => value.endsWith("ies") ? `${value.slice(0, -3)}y` : value.endsWith("s") && !value.endsWith("ss") ? value.slice(0, -1) : value;

function mergeSchemas(left: JsonSchema, right: JsonSchema): JsonSchema {
  const a = objectSchema(left);
  const b = objectSchema(right);
  if (!a || !b) return {};
  if (Object.keys(a).length === 0) return b;
  if (Object.keys(b).length === 0) return a;
  if (a.type === "object" && b.type === "object") {
    const properties: Record<string, JsonSchema> = {};
    const keys = new Set([...Object.keys(a.properties ?? {}), ...Object.keys(b.properties ?? {})]);
    keys.forEach((key) => {
      const first = a.properties?.[key];
      const second = b.properties?.[key];
      properties[key] = first !== undefined && second !== undefined ? mergeSchemas(first, second) : (first ?? second ?? {});
    });
    const required = (a.required ?? []).filter((key) => (b.required ?? []).includes(key));
    return { type: "object", properties, required, additionalProperties: false };
  }
  if (a.type === "array" && b.type === "array") return { type: "array", items: mergeSchemas(a.items ?? {}, b.items ?? {}) };
  if ((a.type === "integer" && b.type === "number") || (a.type === "number" && b.type === "integer")) return { type: "number" };
  if (a.type !== undefined && a.type === b.type) return a;
  const alternatives = [...(a.anyOf ?? [a]), ...(b.anyOf ?? [b])];
  const unique = alternatives.filter((item, index) => alternatives.findIndex((other) => JSON.stringify(other) === JSON.stringify(item)) === index);
  return { anyOf: unique };
}

export function inferSchema(value: unknown): JsonSchema {
  if (value === null) return { type: "null" };
  if (Array.isArray(value)) {
    return { type: "array", items: value.length ? value.map(inferSchema).reduce(mergeSchemas) : {} };
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return { type: "object", properties: Object.fromEntries(entries.map(([key, child]) => [key, inferSchema(child)])), required: entries.map(([key]) => key), additionalProperties: false };
  }
  if (typeof value === "number") return { type: Number.isInteger(value) ? "integer" : "number" };
  if (typeof value === "boolean") return { type: "boolean" };
  return { type: "string" };
}

function resolveRef(ref: string, root: JsonSchema): JsonSchema | undefined {
  if (!ref.startsWith("#/")) return undefined;
  let value: unknown = root;
  for (const segment of ref.slice(2).split("/")) {
    const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
    if (!value || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return typeof value === "boolean" || (typeof value === "object" && value !== null) ? value as JsonSchema : undefined;
}

function literal(value: unknown) {
  return JSON.stringify(value) ?? "null";
}

export function schemaToTypeScript(root: JsonSchema, requestedName = "Root"): string {
  const blocks: string[] = [];
  const names = new Set<string>();
  const seen = new WeakMap<object, string>();

  function uniqueName(hint: string) {
    const base = pascal(hint);
    let name = base;
    let number = 2;
    while (names.has(name)) name = `${base}${number++}`;
    names.add(name);
    return name;
  }

  function convert(input: JsonSchema, hint: string): string {
    if (input === true) return "unknown";
    if (input === false) return "never";
    const schema = input;
    if (schema.$ref) {
      const target = resolveRef(schema.$ref, root);
      return target !== undefined ? convert(target, schema.$ref.split("/").pop() ?? hint) : "unknown";
    }
    if (schema.enum?.length) return schema.enum.map(literal).join(" | ");
    if (Object.prototype.hasOwnProperty.call(schema, "const")) return literal(schema.const);
    const variants = schema.anyOf ?? schema.oneOf;
    if (variants?.length) return variants.map((item, index) => convert(item, `${hint}Variant${index + 1}`)).join(" | ");
    if (schema.allOf?.length) return schema.allOf.map((item, index) => convert(item, `${hint}Part${index + 1}`)).join(" & ");
    if (Array.isArray(schema.type)) return schema.type.map((type) => convert({ ...schema, type }, hint)).join(" | ");
    if (isObjectSchema(schema)) {
      const existing = seen.get(schema);
      if (existing) return existing;
      if (!schema.properties || Object.keys(schema.properties).length === 0) {
        return `Record<string, ${typeof schema.additionalProperties === "object" ? convert(schema.additionalProperties, `${hint}Value`) : "unknown"}>`;
      }
      const name = uniqueName(hint);
      seen.set(schema, name);
      const block = blocks.length;
      blocks.push("");
      const fieldTypes: string[] = [];
      const fields = Object.entries(schema.properties).map(([key, value]) => {
        const optional = !(schema.required ?? []).includes(key) ? "?" : "";
        const fieldType = convert(value, pascal(singular(key)));
        fieldTypes.push(fieldType, ...(optional ? ["undefined"] : []));
        return `  ${propertyName(key)}${optional}: ${fieldType};`;
      });
      if (schema.additionalProperties === true) fields.push("  [key: string]: unknown;");
      else if (typeof schema.additionalProperties === "object") {
        const indexType = convert(schema.additionalProperties, `${name}Value`);
        fields.push(`  [key: string]: ${[...new Set([indexType, ...fieldTypes])].join(" | ")};`);
      }
      blocks[block] = `export interface ${name} {\n${fields.join("\n")}\n}`;
      return name;
    }
    if (schema.type === "array") {
      const child = convert(schema.items ?? {}, schema === root ? `${pascal(hint)}Item` : pascal(singular(hint)));
      return `${child.includes(" | ") || child.includes(" & ") ? `(${child})` : child}[]`;
    }
    if (schema.type === "string") return "string";
    if (schema.type === "number" || schema.type === "integer") return "number";
    if (schema.type === "boolean") return "boolean";
    if (schema.type === "null") return "null";
    return "unknown";
  }

  const rootName = pascal(requestedName);
  const type = convert(root, rootName);
  if (!blocks.length || type !== rootName) blocks.unshift(`export type ${rootName} = ${type};`);
  return `${blocks.join("\n\n")}\n`;
}

export function schemaToZod(root: JsonSchema, requestedName = "Root"): string {
  const rootName = pascal(requestedName);
  const variable = `${rootName[0].toLowerCase()}${rootName.slice(1)}Schema`;
  const seen = new Set<JsonSchema>();

  function convert(input: JsonSchema, depth: number): string {
    if (input === true) return "z.unknown()";
    if (input === false) return "z.never()";
    if (depth > 20 || seen.has(input)) return "z.unknown()";
    if (input.$ref) {
      const target = resolveRef(input.$ref, root);
      if (target === undefined) return "z.unknown()";
      seen.add(input);
      const result = convert(target, depth + 1);
      seen.delete(input);
      return result;
    }
    if (input.enum?.length) {
      if (input.enum.every((item) => typeof item === "string")) return `z.enum([${input.enum.map(literal).join(", ")}])`;
      return input.enum.length === 1 ? `z.literal(${literal(input.enum[0])})` : `z.union([${input.enum.map((item) => `z.literal(${literal(item)})`).join(", ")}])`;
    }
    if (Object.prototype.hasOwnProperty.call(input, "const")) return `z.literal(${literal(input.const)})`;
    const variants = input.anyOf ?? input.oneOf;
    if (variants?.length) return variants.length === 1 ? convert(variants[0], depth + 1) : `z.union([${variants.map((item) => convert(item, depth + 1)).join(", ")}])`;
    if (input.allOf?.length) return input.allOf.map((item) => convert(item, depth + 1)).reduce((first, second) => `${first}.and(${second})`);
    if (Array.isArray(input.type)) return `z.union([${input.type.map((type) => convert({ ...input, type }, depth + 1)).join(", ")}])`;
    let output = "z.unknown()";
    if (isObjectSchema(input)) {
      if (!input.properties || Object.keys(input.properties).length === 0) {
        output = `z.record(z.string(), ${typeof input.additionalProperties === "object" ? convert(input.additionalProperties, depth + 1) : "z.unknown()"})`;
      } else {
        seen.add(input);
        const indent = "  ".repeat(depth + 1);
        const fields = Object.entries(input.properties).map(([key, value]) => {
          let child = convert(value, depth + 1);
          if (!(input.required ?? []).includes(key)) child += ".optional()";
          return `${indent}${propertyName(key)}: ${child},`;
        });
        seen.delete(input);
        output = `z.object({\n${fields.join("\n")}\n${"  ".repeat(depth)}})`;
        if (input.additionalProperties === false) output += ".strict()";
        else if (input.additionalProperties === true) output += ".passthrough()";
        else if (typeof input.additionalProperties === "object") output += `.catchall(${convert(input.additionalProperties, depth + 1)})`;
      }
    } else if (input.type === "array") {
      output = `z.array(${convert(input.items ?? {}, depth + 1)})`;
      if (typeof input.minItems === "number") output += `.min(${input.minItems})`;
      if (typeof input.maxItems === "number") output += `.max(${input.maxItems})`;
    } else if (input.type === "string") {
      output = "z.string()";
      if (input.format === "email") output += ".email()";
      if (input.format === "uri") output += ".url()";
      if (input.format === "uuid") output += ".uuid()";
      if (input.format === "date-time") output += ".datetime({ offset: true })";
      if (typeof input.minLength === "number") output += `.min(${input.minLength})`;
      if (typeof input.maxLength === "number") output += `.max(${input.maxLength})`;
    } else if (input.type === "number" || input.type === "integer") {
      output = `z.number()${input.type === "integer" ? ".int()" : ""}`;
      if (typeof input.minimum === "number") output += `.min(${input.minimum})`;
      if (typeof input.maximum === "number") output += `.max(${input.maximum})`;
    } else if (input.type === "boolean") output = "z.boolean()";
    else if (input.type === "null") output = "z.null()";
    return output;
  }

  return `import { z } from "zod";\n\nexport const ${variable} = ${convert(root, 0)};\n\nexport type ${rootName} = z.infer<typeof ${variable}>;\n`;
}

const pythonKeywords = new Set(["class", "def", "return", "from", "import", "pass", "if", "else", "for", "while", "try", "except", "finally", "with", "as", "lambda", "global", "nonlocal", "in", "is", "not", "and", "or", "True", "False", "None", "async", "await", "yield", "raise", "del", "assert", "break", "continue"]);
const pythonLiteral = (value: unknown) => value === null ? "None" : value === true ? "True" : value === false ? "False" : literal(value);

export function schemaToPydantic(root: JsonSchema, requestedName = "Root"): string {
  const blocks: string[] = [];
  const seen = new WeakMap<object, string>();
  const names = new Set<string>();
  let needsField = false;
  let needsRoot = false;
  let needsConfig = false;

  function uniqueName(hint: string) {
    const base = pascal(hint);
    let result = base;
    let count = 2;
    while (names.has(result)) result = `${base}${count++}`;
    names.add(result);
    return result;
  }

  function convert(input: JsonSchema, hint: string): string {
    if (typeof input === "boolean") return "Any";
    if (input.$ref) {
      const target = resolveRef(input.$ref, root);
      return target === undefined ? "Any" : convert(target, input.$ref.split("/").pop() ?? hint);
    }
    if (input.enum?.length) return `Literal[${input.enum.map(pythonLiteral).join(", ")}]`;
    if (Object.prototype.hasOwnProperty.call(input, "const")) return `Literal[${pythonLiteral(input.const)}]`;
    const variants = input.anyOf ?? input.oneOf;
    if (variants?.length) return variants.map((item, index) => convert(item, `${hint}Variant${index + 1}`)).join(" | ");
    if (Array.isArray(input.type)) return input.type.map((type) => convert({ ...input, type }, hint)).join(" | ");
    if (isObjectSchema(input)) {
      const existing = seen.get(input);
      if (existing) return existing;
      if (!input.properties || Object.keys(input.properties).length === 0) return `dict[str, ${typeof input.additionalProperties === "object" ? convert(input.additionalProperties, `${hint}Value`) : "Any"}]`;
      const name = uniqueName(hint);
      seen.set(input, name);
      const block = blocks.length;
      blocks.push("");
      const fieldNames = new Set<string>();
      const fields = Object.entries(input.properties).map(([key, value]) => {
        const safe = key.replace(/\W/g, "_").replace(/^(\d)/, "field_$1").replace(/^_+/, "field_") || "field";
        const base = pythonKeywords.has(safe) || safe === "model_config" ? `${safe}_` : safe;
        let field = base;
        let suffix = 2;
        while (fieldNames.has(field)) field = `${base}_${suffix++}`;
        fieldNames.add(field);
        const optional = !(input.required ?? []).includes(key);
        const annotation = convert(value, pascal(singular(key)));
        const alias = field !== key;
        if (alias) needsField = true;
        const assignment = alias ? ` = Field(${optional ? "default=None, " : ""}alias=${literal(key)})` : optional ? " = None" : "";
        return `    ${field}: ${annotation}${optional ? " | None" : ""}${assignment}`;
      });
      if (input.additionalProperties === false) {
        needsConfig = true;
        fields.unshift('    model_config = ConfigDict(extra="forbid")', "");
      }
      blocks[block] = `class ${name}(BaseModel):\n${fields.join("\n") || "    pass"}`;
      return name;
    }
    if (input.type === "array") return `list[${convert(input.items ?? {}, input === root ? `${pascal(hint)}Item` : pascal(singular(hint)))}]`;
    if (input.type === "string") return "str";
    if (input.type === "integer") return "int";
    if (input.type === "number") return "float";
    if (input.type === "boolean") return "bool";
    if (input.type === "null") return "None";
    return "Any";
  }

  const rootName = pascal(requestedName);
  const type = convert(root, rootName);
  blocks.reverse();
  if (!blocks.length || type !== rootName) {
    needsRoot = true;
    blocks.push(`class ${rootName}(RootModel[${type}]):\n    pass`);
  }
  const body = blocks.join("\n\n\n");
  const typing = [body.includes("Any") ? "Any" : "", body.includes("Literal[") ? "Literal" : ""].filter(Boolean);
  return `from __future__ import annotations\n${typing.length ? `from typing import ${typing.join(", ")}\n` : ""}from pydantic import ${["BaseModel", needsConfig ? "ConfigDict" : "", needsField ? "Field" : "", needsRoot ? "RootModel" : ""].filter(Boolean).join(", ")}\n\n\n${body}\n`;
}