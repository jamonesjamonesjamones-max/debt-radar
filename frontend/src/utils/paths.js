/**
 * paths.js — Acortado de rutas de archivo multiplataforma para mostrar en la UI.
 *
 * Problema que resuelve: las rutas absolutas de un proyecto pueden ser muy
 * largas (ej. "C:\Users\name\OneDrive\Documents\...\backend\analyzer\scanner.py").
 * Truncar con CSS ("truncate" + ellipsis al final) corta justo la parte útil
 * (el nombre del archivo), dejando visible solo el prefijo repetitivo que no
 * ayuda a identificar de qué archivo se trata.
 *
 * shortenPath() en cambio conserva los ÚLTIMOS componentes de la ruta
 * (los más específicos), y antepone "…" si se recortó el inicio.
 */

/**
 * Acorta una ruta a sus últimos `keep` componentes, soportando separadores
 * "/" (Unix) y "\" (Windows) en el mismo string.
 *
 * @param {string} path - Ruta completa del archivo.
 * @param {number} keep - Cuántos componentes finales conservar (por defecto 2:
 *   carpeta contenedora + nombre de archivo).
 * @returns {string} Ruta acortada, ej. "…\analyzer\scanner.py"
 */
export function shortenPath(path, keep = 2) {
  if (!path) return path || "";

  const parts = path.split(/[/\\]+/).filter(Boolean);
  if (parts.length <= keep) return path;

  const kept = parts.slice(-keep);
  return "…\\" + kept.join("\\");
}

/**
 * Devuelve solo el nombre de archivo (último componente), sin el resto de la ruta.
 * @param {string} path
 * @returns {string}
 */
export function fileName(path) {
  if (!path) return path || "";
  const parts = path.split(/[/\\]+/).filter(Boolean);
  return parts[parts.length - 1] || path;
}
