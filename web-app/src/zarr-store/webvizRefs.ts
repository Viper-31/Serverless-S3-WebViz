import type { RefSpec } from "./types";

const S3_WEBVIZ_PREFIX = "s3://webviz/";
const PUBLIC_HTTP_PREFIX = "https://projects.pawsey.org.au/webviz/";

// Avoid mutating the input reference, but uses a deep copy to ensure nested objects are captured.
function deepCopy<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => deepCopy(item)) as T;

  if (value && typeof value === "object") {
    const copy: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>,
    )) {
      copy[key] = deepCopy(entry);
    }
    return copy as T;
  }
  return value;
}

function rewriteRefValue(value: unknown): unknown {
  if (
    !Array.isArray(value) ||
    typeof value[0] !== "string" ||
    !value[0].startsWith(S3_WEBVIZ_PREFIX)
  ) {
    return value;
  }

  return [
    PUBLIC_HTTP_PREFIX + value[0].slice(S3_WEBVIZ_PREFIX.length),
    ...value.slice(1),
  ];
}

export function rewriteWebvizS3RefsToPublicHttp<T extends RefSpec>(spec: T): T {
  const next = deepCopy(spec);

  if (next.refs) {
    for (const key of Object.keys(next.refs)) {
      next.refs[key] = rewriteRefValue(next.refs[key]);
    }
  }
  return next;
}

export function prepareWebvizRefSpec<T extends RefSpec>(spec: T): T {
  return rewriteWebvizS3RefsToPublicHttp(spec);
}
