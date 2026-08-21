export type DocumentClaims = {
  documentType: string;
  uploadTypes: string[];
  roles: string[];
  endpoints: { method: string; path: string }[];
  states: string[];
  entities: string[];
};

const UPLOAD_TYPE_NORMALIZE: Record<string, string> = {
  pdf: "pdf",
  png: "png",
  jpeg: "jpeg",
  jpg: "jpeg",
  gif: "gif",
  webp: "webp",
  csv: "csv",
  xlsx: "xlsx",
  xls: "xlsx",
  excel: "xlsx",
  docx: "docx",
  word: "docx",
  svg: "svg",
  mp4: "mp4",
  zip: "zip",
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpeg",
  "text/csv": "csv",
};

const ENDPOINT_PATTERN =
  /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/api\/[a-z0-9_\-/{}\[\]:]+)/gi;
const EXTENSION_PATTERN = /\.(pdf|png|jpe?g|gif|webp|csv|xlsx|xls|docx|svg|mp4|zip)\b/gi;
const NAMED_UPLOAD_PATTERN =
  /\b(PDF|PNG|JPEG|JPG|GIF|WebP|CSV|Excel|XLSX|Word|DOCX|SVG|MP4|ZIP)\b/g;
const MIME_PATTERN =
  /\b(application\/pdf|image\/(?:png|jpeg|gif|webp)|text\/csv|application\/vnd\.[\w.+-]+)\b/gi;
const STATE_PATTERN = /\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g;
const ENTITY_PATTERN = /\b([a-z][a-z0-9_]{2,})\b/g;
const ROLE_PATTERN = /\b(Owner|Admin|Approver|Manager|Member|User|Guest|[A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b/g;

function normalizeUploadType(raw: string): string | null {
  const key = raw.trim().toLowerCase().replace(/^\./, "");
  return UPLOAD_TYPE_NORMALIZE[key] ?? UPLOAD_TYPE_NORMALIZE[key.replace(/\s+/g, "")] ?? null;
}

export function normalizeUploadTypes(types: string[]): string[] {
  return [...new Set(types.map(normalizeUploadType).filter(Boolean) as string[])].sort();
}

export function extractUploadTypes(text: string): string[] {
  const found: string[] = [];

  for (const match of text.matchAll(EXTENSION_PATTERN)) {
    const normalized = normalizeUploadType(match[1]);
    if (normalized) found.push(normalized);
  }
  for (const match of text.matchAll(NAMED_UPLOAD_PATTERN)) {
    const normalized = normalizeUploadType(match[1]);
    if (normalized) found.push(normalized);
  }
  for (const match of text.matchAll(MIME_PATTERN)) {
    const normalized = normalizeUploadType(match[1]);
    if (normalized) found.push(normalized);
  }

  return normalizeUploadTypes(found);
}

export function extractEndpoints(text: string): DocumentClaims["endpoints"] {
  const endpoints: DocumentClaims["endpoints"] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(ENDPOINT_PATTERN)) {
    const method = match[1].toUpperCase();
    const path = match[2].replace(/\/+$/, "");
    const key = `${method}:${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    endpoints.push({ method, path });
  }

  return endpoints.sort((a, b) => a.path.localeCompare(b.path));
}

export function extractStates(text: string): string[] {
  const states = new Set<string>();
  for (const match of text.matchAll(STATE_PATTERN)) {
    const state = match[1];
    if (state.length >= 4 && state.includes("_")) {
      states.add(state);
    }
  }
  return [...states].sort();
}

export function extractEntities(text: string, knownEntities: string[] = []): string[] {
  const known = new Set(knownEntities);
  const entities = new Set<string>();
  const lower = text.toLowerCase();

  for (const entity of knownEntities) {
    if (lower.includes(entity)) entities.add(entity);
  }

  for (const match of lower.matchAll(ENTITY_PATTERN)) {
    const name = match[1];
    if (name.includes("_") && name.length > 3) {
      entities.add(name);
    }
  }

  return [...entities].filter((name) => known.size === 0 || known.has(name)).sort();
}

export function extractRoles(text: string, knownRoles: string[] = []): string[] {
  const roles = new Set<string>();
  for (const role of knownRoles) {
    const spaced = role.replace(/_/g, " ");
    if (new RegExp(`\\b${spaced}\\b`, "i").test(text) || new RegExp(`\\b${role}\\b`, "i").test(text)) {
      roles.add(role);
    }
  }
  for (const match of text.matchAll(ROLE_PATTERN)) {
    const normalized = match[1].toLowerCase().replace(/\s+/g, "_");
    if (knownRoles.length === 0 || knownRoles.includes(normalized)) {
      roles.add(normalized);
    }
  }
  return [...roles].sort();
}

export function extractClaimsFromDocument(
  documentType: string,
  content: string,
  options?: { knownEntities?: string[]; knownRoles?: string[] }
): DocumentClaims {
  return {
    documentType,
    uploadTypes: extractUploadTypes(content),
    roles: extractRoles(content, options?.knownRoles ?? []),
    endpoints: extractEndpoints(content),
    states: extractStates(content),
    entities: extractEntities(content, options?.knownEntities ?? []),
  };
}
