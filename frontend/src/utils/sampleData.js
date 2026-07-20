/**
 * sampleData.js — Demo dataset for the "Explore Sample Report" feature.
 * Lets judges see the full dashboard without scanning a real project.
 */

const SAMPLE_FILES = [
  {
    path: "src/legacy/DataProcessor.ts",
    score: 28,
    lines: 1247,
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
    violations: [
      { type: "magic_number", severity: "low", line: 42, context: "const CACHE_TTL = 3600;" },
      { type: "complex_function", severity: "medium", line: 78, context: "function initializeEngine(config) { /* 16 branches */ }" },
    ],
  },
  {
    path: "src/api/routes.ts",
    score: 72,
    lines: 315,
    violations: [
      { type: "todo", severity: "low", line: 1, context: "// TODO: add rate limiting middleware" },
      { type: "magic_number", severity: "low", line: 22, context: "const PAGE_SIZE = 50;" },
    ],
  },
  {
    path: "src/components/CheckoutForm.tsx",
    score: 55,
    lines: 520,
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

export const SAMPLE_JOB_ID = "demo-sample-report";

export default SAMPLE_DATA;
