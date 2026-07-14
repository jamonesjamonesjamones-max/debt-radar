/**
 * Hook useAnalysis — Maneja POST inicial + conexión SSE para progreso en tiempo real.
 */

import { useState, useRef, useCallback } from "react";
import { startScan, createScanStream } from "../api/client";

/**
 * Estados posibles:
 * - idle: sin escaneo activo
 * - scanning: escaneo en progreso (SSE conectado)
 * - error: fallo en el escaneo
 * - empty: escaneo completado pero sin archivos encontrados
 * - done: escaneo completado con resultados
 */

export function useAnalysis() {
  const [state, setState] = useState("idle");
  const [data, setData] = useState(null);
  const [progress, setProgress] = useState({
    percent: 0,
    elapsed: 0,
    currentFile: "",
    filesCompleted: 0,
    totalFiles: 0,
  });
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(null);
  const [jobId, setJobId] = useState(null);
  const eventSourceRef = useRef(null);

  const reset = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState("idle");
    setData(null);
    setError("");
    setProgress({
      percent: 0,
      elapsed: 0,
      currentFile: "",
      filesCompleted: 0,
      totalFiles: 0,
    });
  }, []);

  const startScanFlow = useCallback(
    async (scanPath, workers) => {
      reset();

      try {
        // 1. Crear el job via POST
        const { job_id } = await startScan(scanPath, workers);
        setJobId(job_id);
        setState("scanning");

        // 2. Conectar SSE para progreso
        const es = createScanStream(job_id);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);

            // Actualizar progreso
            setProgress({
              percent: payload.progress || 0,
              elapsed: payload.elapsed || 0,
              currentFile: payload.current_file || "",
              filesCompleted: payload.files_completed || 0,
              totalFiles: payload.total_files || 0,
            });

            // Job completado
            if (payload.status === "completed") {
              es.close();
              eventSourceRef.current = null;

              if (payload.result) {
                const totalFiles =
                  payload.result.files?.length ||
                  payload.result.summary?.total_files ||
                  0;
                if (totalFiles === 0) {
                  setState("empty");
                } else {
                  setData(payload.result);
                  setState("done");
                }
              } else {
                setState("empty");
              }
            }

            // Job con error
            if (payload.status === "error") {
              es.close();
              eventSourceRef.current = null;
              setError(payload.error || "Error desconocido en el escaneo");
              setState("error");
            }
          } catch (parseErr) {
            console.error("Error parsing SSE data:", parseErr);
          }
        };

        es.onerror = () => {
          es.close();
          eventSourceRef.current = null;
          // Solo marcar error si seguimos en scanning (no fue un cierre limpio)
          setState((prev) => {
            if (prev === "scanning") {
              setError("Connection lost with server");
              return "error";
            }
            return prev;
          });
        };
      } catch (err) {
        // Detectar errores específicos del backend
        setError(err.message);
        // Extraer status code si está en el mensaje
        if (err.message.includes("5000 files") || err.message.includes("max 5000")) {
          setErrorStatus(400);
        } else {
          setErrorStatus(null);
        }
        setState("error");
      }
    },
    [reset]
  );

  return {
    state,
    data,
    progress,
    error,
    errorStatus,
    jobId,
    startScan: startScanFlow,
    reset,
  };
}
