/**
 * sampleData.js — Demo dataset for the "Explore Sample Report" feature.
 * Lets judges see the full dashboard without scanning a real project.
 */

const SAMPLE_FILES = [
  {
    path: "src/legacy/DataProcessor.ts",
    score: 28,
    lines: 1247,
    deductions: { file_size: -15, complexity: -30, todos: -10, magic_numbers: -12, function_complexity: -5 },
    violations: [
      { type: "max_nesting", severity: "high", line: 45, context: "for (const item of items) { if (item.active) { for (const dep of item.dependencies) { if (dep.status === 'pending') { switch(dep.type) { ... } } } } }" },
      { type: "magic_number", severity: "low", line: 23, context: "const timeout = 30000;" },
      { type: "magic_number", severity: "low", line: 67, context: "if (retries > 3) throw new Error('max retries');" },
      { type: "todo", severity: "medium", line: 12, context: "// TODO: handle edge case when batch is empty" },
      { type: "complex_function", severity: "high", line: 30, context: "function processBatch(items) { /* 28 branches */ }" },
    ],
  },
  {
    path: "src/services/PaymentGateway.ts",
    score: 19,
    lines: 892,
    deductions: { file_size: -10, complexity: -35, todos: -15, magic_numbers: -15, function_complexity: -6 },
    violations: [
      { type: "max_nesting", severity: "high", line: 120, context: "try { if (response.ok) { for (const t of transactions) { if (t.amount > 0) { ... } } } } catch { }" },
      { type: "magic_number", severity: "low", line: 15, context: "const TAX_RATE = 0.16;" },
      { type: "todo", severity: "medium", line: 5, context: "// FIXME: refund flow does not handle partial refunds" },
      { type: "magic_number", severity: "low", line: 88, context: "rate = 2.5;" },
      { type: "complex_function", severity: "high", line: 100, context: "function settlePayments(payments) { /* 22 branches */ }" },
    ],
  },
  {
    path: "src/utils/validation.ts",
    score: 45,
    lines: 654,
    deductions: { file_size: -5, complexity: -20, todos: -10, magic_numbers: -10, function_complexity: -10 },
    violations: [
      { type: "max_nesting", severity: "medium", line: 55, context: "if (user) { if (user.role) { if (role.permissions) { ... } } }" },
      { type: "magic_number", severity: "low", line: 10, context: "const MAX_FILE_SIZE = 10485760;" },
      { type: "todo", severity: "medium", line: 3, context: "// TODO: add phone number validation" },
    ],
  },
  {
    path: "src/core/Engine.ts",
    score: 61,
    lines: 423,
    deductions: { file_size: -3, complexity: -15, todos: -5, magic_numbers: -10, function_complexity: -6 },
    violations: [
      { type: "magic_number", severity: "low", line: 42, context: "const CACHE_TTL = 3600;" },
      { type: "complex_function", severity: "medium", line: 78, context: "function initializeEngine(config) { /* 16 branches */ }" },
    ],
  },
  {
    path: "src/api/routes.ts",
    score: 72,
    lines: 315,
    deductions: { file_size: -2, complexity: -8, todos: -10, magic_numbers: -5, function_complexity: -3 },
    violations: [
      { type: "todo", severity: "low", line: 1, context: "// TODO: add rate limiting middleware" },
      { type: "magic_number", severity: "low", line: 22, context: "const PAGE_SIZE = 50;" },
    ],
  },
  {
    path: "src/components/CheckoutForm.tsx",
    score: 55,
    lines: 520,
    deductions: { file_size: -4, complexity: -18, todos: -8, magic_numbers: -10, function_complexity: -5 },
    violations: [
      { type: "max_nesting", severity: "medium", line: 85, context: "if (formState.valid) { if (formState.submitted) { for (const field of required) { ... } } }" },
      { type: "magic_number", severity: "low", line: 15, context: "const CARD_LENGTH = 16;" },
    ],
  },
];



const violationsByType = {
  max_nesting: 4,
  magic_number: 7,
  todo: 3,
  complex_function: 3,
};

const SAMPLE_SUMMARY = {
  grade: "C",
  average_score: 67,
  total_files: 6,
  total_lines: 4051,
  total_violations: 14,
  scan_time_seconds: 3.2,
  workers_used: 4,
  files_skipped: 0,
  grade_distribution: { A: 2, B: 1, C: 2, D: 0, F: 1 },
  violations_by_type: violationsByType,
  scan_path: "/workspace/sample-ecommerce",
};

export const SAMPLE_DATA = {
  summary: SAMPLE_SUMMARY,
  files: SAMPLE_FILES,
  skipped_files: [],
};

export const SAMPLE_DEPENDENCY_GRAPH = {
  nodes: [
    { id: 0, name: "DataProcessor.ts", fullPath: "src/legacy/DataProcessor.ts", score: 28, violations: 5, lines: 1247, language: "typescript" },
    { id: 1, name: "PaymentGateway.ts", fullPath: "src/services/PaymentGateway.ts", score: 19, violations: 5, lines: 892, language: "typescript" },
    { id: 2, name: "validation.ts", fullPath: "src/utils/validation.ts", score: 45, violations: 3, lines: 654, language: "typescript" },
    { id: 3, name: "Engine.ts", fullPath: "src/core/Engine.ts", score: 61, violations: 2, lines: 423, language: "typescript" },
    { id: 4, name: "routes.ts", fullPath: "src/api/routes.ts", score: 72, violations: 2, lines: 315, language: "typescript" },
    { id: 5, name: "CheckoutForm.tsx", fullPath: "src/components/CheckoutForm.tsx", score: 55, violations: 2, lines: 520, language: "typescript" },
  ],
  edges: [
    { source: 0, target: 2 },
    { source: 0, target: 4 },
    { source: 1, target: 2 },
    { source: 1, target: 4 },
    { source: 0, target: 5 },
    { source: 1, target: 5 },
    { source: 3, target: 4 },
    { source: 3, target: 2 },
    { source: 5, target: 2 },
    { source: 4, target: 3 },
  ],
};

export const SAMPLE_GIT_HISTORY = {
  commits: [
    { hash: "a1b2c3d", date: "2026-07-15", message: "feat: add payment refund flow", score: 55, author: "alice" },
    { hash: "e4f5g6h", date: "2026-07-12", message: "refactor: extract validation utils", score: 48, author: "bob" },
    { hash: "i7j8k9l", date: "2026-07-10", message: "feat: implement data processor", score: 42, author: "alice" },
    { hash: "m0n1o2p", date: "2026-07-08", message: "chore: initial project setup", score: 61, author: "carol" },
  ],
  trend: "declining",
  score_diff: -6,
};

export const SAMPLE_GIT_BLAME = {
  authors: [
    { name: "alice", total_issues: 8, files_touched: 3, top_issue: "max_nesting" },
    { name: "bob", total_issues: 4, files_touched: 2, top_issue: "magic_number" },
    { name: "carol", total_issues: 2, files_touched: 2, top_issue: "todo" },
  ],
};

export const SAMPLE_JOB_ID = "demo-sample-report";

export default SAMPLE_DATA;
