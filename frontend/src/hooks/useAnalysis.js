/**
 * Hook useAnalysis — Maneja POST inicial + conexión SSE para progreso en tiempo real.
 */

import { useState, useRef, useCallback } from "react";
import { startScan, createScanStream, uploadFile } from "../api/client";

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
  const [analysisSource, setAnalysisSource] = useState("none");
  const eventSourceRef = useRef(null);
  // Flag that gets set synchronously in onmessage when scan finishes.
  // Prevents onerror (fired when the SSE connection drops) from
  // overwriting "done" state with "error" due to a race condition.
  const doneRef = useRef(false);

  const reset = useCallback(() => {
    doneRef.current = false;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState("idle");
    setData(null);
    setJobId(null);
    setAnalysisSource("none");
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
              doneRef.current = true;
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
                  setAnalysisSource("server");
                  setState("done");
                  // Cache result in IndexedDB for offline access
                  import("../hooks/useIndexedDB").then(function(m) {
                    m.cacheScanResult(job_id, payload.result);
                  }).catch(function(){});
                }
              } else {
                setState("empty");
              }
            }

            // Job con error
            if (payload.status === "error") {
              doneRef.current = true;
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
          // Si ya recibimos "completed" o "error" via onmessage, ignoramos
          // el onerror. Esto evita que la reconexión automática del EventSource
          // (que se dispara cuando la conexión TCP se cierra) sobreescriba
          // el estado "done" con "error".
          if (doneRef.current) {
            return;
          }
          es.close();
          eventSourceRef.current = null;
          // Solo marcar error si seguimos en scanning (no fue un cierre limpio)
          setState((prev) => {
            if (prev === "scanning") {
              return "error";
            }
            return prev;
          });
          setError(
            "The scan started, but the progress stream could not connect. " +
            "Make sure the backend is running on port 8000 and retry."
          );
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

  const startUpload = useCallback(async (file) => {
    reset();
    setState("uploading");

    try {
      setProgress({
        percent: 0,
        elapsed: 0,
        currentFile: file.name,
        filesCompleted: 0,
        totalFiles: 1,
      });

      const onProgress = (pct) => {
        setProgress({
          percent: Math.round(pct * 90),
          elapsed: 0,
          currentFile: file.name,
          filesCompleted: pct > 0.5 ? 1 : 0,
          totalFiles: 1,
        });
      };

      const result = await uploadFile(file, onProgress);

      // Transformar resultado individual al formato del Dashboard
      const singleFileData = {
        summary: {
          grade: result.score >= 90 ? "A" : result.score >= 75 ? "B" : result.score >= 60 ? "C" : result.score >= 40 ? "D" : "F",
          average_score: result.score,
          total_files: 1,
          total_lines: result.lines,
          total_violations: result.violations?.length || 0,
          scan_time_seconds: 0.5,
          workers_used: 1,
          files_skipped: 0,
          grade_distribution: { A: 0, B: 0, C: 0, D: 0, F: 0 },
          violations_by_type: {},
          scan_path: file.name,
        },
        files: [{
          path: result.filename,
          score: result.score,
          lines: result.lines,
          language: result.language,
          deductions: result.deductions,
          violations: result.violations || [],
        }],
        skipped_files: [],
      };

      // Calculate grade distribution
      const g = singleFileData.summary.grade;
      singleFileData.summary.grade_distribution[g] = 1;

      // Calculate violations by type
      if (result.violations) {
        for (const v of result.violations) {
          singleFileData.summary.violations_by_type[v.type] =
            (singleFileData.summary.violations_by_type[v.type] || 0) + 1;
        }
      }

      setProgress({
        percent: 100,
        elapsed: 0.5,
        currentFile: "",
        filesCompleted: 1,
        totalFiles: 1,
      });

      setData(singleFileData);
      setJobId("upload-" + Date.now());
      setAnalysisSource("upload");
      setState("done");

    } catch (err) {
      setError(err.message);
      setState("error");
    }
  }, [reset]);

  const loadDemo = useCallback(() => {
    // Lazy-import sample data and inject it as if a scan completed
    import("../utils/sampleData").then(function(m) {
      setData(m.SAMPLE_DATA);
      setJobId(m.SAMPLE_JOB_ID);
      setAnalysisSource("demo");
      setState("done");
      setProgress({
        percent: 100,
        elapsed: 3.2,
        currentFile: "",
        filesCompleted: m.SAMPLE_DATA.summary.total_files,
        totalFiles: m.SAMPLE_DATA.summary.total_files,
      });
    }).catch(function() {
      setError("Failed to load sample data");
      setState("error");
    });
  }, []);

  return {
    state,
    data,
    progress,
    error,
    errorStatus,
    jobId,
    analysisSource,
    startScan: startScanFlow,
    loadDemo,
    startUpload,
    reset,
  };
}
