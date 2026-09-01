#  SchemaPulse 
b u
A  local - first  developer  workspace for validating JSON, generating types, building mock data, and comparing JSON documents.

## Run locally

```sh
npm install
npm run dev
```

Run `npm run build` to create a production build.

## Workspaces

- **Schema Validator:** Validates JSON Schema Draft-07, 2019-09, and 2020-12 with format checks and line-specific diagnostics. The Zod editor safely parses a subset of common types and validators; custom refinements and arbitrary code are not executed.
- **TS/Zod Generator:** Infers TypeScript, Zod, or Pydantic v2 models from an example JSON value. Inference reflects the examples provided, so review the output before using it as a contract.
- **Mock Data Studio:** Generates up to 100 records from the current or a preset schema and checks each record against that schema. Complex or contradictory constraints may not be generatable.
- **Diff Analyzer:** Compares JSON structure and values, including array items by index.

Data is processed in the browser and is not sent to a server.