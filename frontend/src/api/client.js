/**
 * API client — Configuración base para comunicación con el backend.
 */

// En producción (Docker/Nginx), la API comparte el mismo origen bajo /api.
// VITE_API_BASE permite conservar un backend remoto opcional sin recompilar llamadas.
export const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "";

/**
 * Inicia un escaneo.
 * @param {string} path - Ruta del repositorio
 * @param {number} workers - Número de workers (1-8)
 * @returns {Promise<{job_id: string, status: string}>}
 */
export async function startScan(path, workers = 4) {
  const res = await fetch(`${API_BASE}/api/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, workers }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Crea un EventSource para el stream de progreso de un job.
 * @param {string} jobId
 * @returns {EventSource}
 */
export function createScanStream(jobId) {
  return new EventSource(`${API_BASE}/api/scan/${jobId}/stream`);
}

/**
 * Exporta el reporte HTML como blob.
 * @param {string} jobId
 * @returns {Promise<Blob>}
 */
export async function exportReport(jobId) {
  const res = await fetch(`${API_BASE}/api/export-html`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId }),
  });

  if (!res.ok) {
    throw new Error(`Error exporting report: ${res.status}`);
  }

  return res.blob();
}
