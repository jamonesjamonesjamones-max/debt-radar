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
  const url = `${API_BASE}/api/scan`;
  let res;

  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, workers }),
    });
  } catch (error) {
    throw new Error(
      `Cannot reach the DebtRadar backend at ${url}. ` +
      "Start the backend on port 8000 and try again. " +
      `Details: ${error.message}`
    );
  }

  const body = await res.text();
  let parsed = null;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    // Proxies can return HTML/plain text for 404, 502, or 500 responses.
  }

  if (!res.ok) {
    const detail = parsed?.detail || body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    throw new Error(detail || `HTTP ${res.status} ${res.statusText}`);
  }

  if (!parsed) {
    throw new Error(`Backend returned an invalid response (HTTP ${res.status}).`);
  }

  return parsed;
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
