export type Difference = { kind: "added" | "removed" | "changed"; path: string; before?: unknown; after?: unknown };

export function compareJson(before: unknown, after: unknown): Difference[] {
  const differences: Difference[] = [];
  const pathFor = (path: string, key: string | number) => typeof key === "number" ? `${path}[${key}]` : /^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
  const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

  function walk(left: unknown, right: unknown, path: string) {
    if (Array.isArray(left) && Array.isArray(right)) {
      for (let index = 0; index < Math.max(left.length, right.length); index++) {
        if (index >= left.length) differences.push({ kind: "added", path: pathFor(path, index), after: right[index] });
        else if (index >= right.length) differences.push({ kind: "removed", path: pathFor(path, index), before: left[index] });
        else walk(left[index], right[index], pathFor(path, index));
      }
    } else if (isRecord(left) && isRecord(right)) {
      for (const key of Object.keys(left)) {
        if (!Object.prototype.hasOwnProperty.call(right, key)) differences.push({ kind: "removed", path: pathFor(path, key), before: left[key] });
        else walk(left[key], right[key], pathFor(path, key));
      }
      for (const key of Object.keys(right)) {
        if (!Object.prototype.hasOwnProperty.call(left, key)) differences.push({ kind: "added", path: pathFor(path, key), after: right[key] });
      }
    } else if (!Object.is(left, right)) differences.push({ kind: "changed", path, before: left, after: right });
  }
  walk(before, after, "$");
  return differences;
}