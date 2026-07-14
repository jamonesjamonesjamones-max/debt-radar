# Bugfix Requirements Document

## Introduction

Durante una revisión funcional de DebtRadar (auditor de deuda técnica: backend Python/FastAPI + frontend React/Vite) se confirmaron en vivo tres defectos relacionados con el manejo de rutas dependiente de plataforma. Todos tienen su origen en que el código asume rutas de estilo Unix (separador `/`) y falla en Windows, donde las rutas usan backslash `\` y prefijos de unidad como `C:\`.

Los tres defectos son:

- **BUG #1 (Crítico — Seguridad):** La protección de directorios sensibles (`SENSITIVE_PATHS` + `_validate_path`) en `backend/api/routes.py` está rota en Windows. El conjunto `SENSITIVE_PATHS` solo contiene rutas Unix y la comparación (`expanded == sensitive or expanded.startswith(sensitive + "/")`) nunca coincide con rutas de Windows (`C:\Windows\System32`). Verificado en vivo: escanear `C:\Windows\System32` devuelve `200 OK` en lugar de `403`.
- **BUG #2 (Medio — Inconsistencia de seguridad):** El CLI (`backend/cli.py::_run_scan`) valida existencia y que sea directorio, pero NO aplica la validación de directorios sensibles que sí aplica la API. Las dos superficies de entrada tienen protecciones distintas.
- **BUG #3 (Menor — Cosmético):** El acortado de rutas en el CLI (`backend/cli.py::_show_text_report`) usa `"/" in short_path` y `split("/")`. En Windows las rutas usan `\`, así que el acortado nunca se aplica y las tablas muestran rutas absolutas completas y largas.

El objetivo del arreglo es hacer el manejo de rutas multiplataforma (Windows y Unix/Mac) sin alterar ningún comportamiento existente que ya funciona correctamente (escaneo, scoring, SSE, badge, export, CLI, historial de git).

### Bug Condition y Propiedades (metodología de condición de bug)

**BUG #1 — Condición de bug**

```pascal
FUNCTION isBugCondition_1(path)
  INPUT: path of type string (input to _validate_path)
  OUTPUT: boolean

  // El path resuelto apunta a un directorio sensible del sistema
  // que _validate_path NO logra reconocer en la plataforma actual.
  resolved ← normalize(abspath(expanduser(path)))
  RETURN pointsToSensitiveSystemDir(resolved) AND NOT currentlyBlocked(resolved)
END FUNCTION
```

En Windows `isBugCondition_1` es verdadera para rutas como `C:\Windows`, `C:\Windows\System32`, `C:\Program Files`, `C:\ProgramData`, etc., porque `SENSITIVE_PATHS` solo contiene rutas Unix.

```pascal
// Property: Fix Checking - Bloqueo de directorios sensibles multiplataforma
FOR ALL path WHERE isBugCondition_1(path) DO
  ASSERT _validate_path'(path) raises HTTPException(status_code = 403)
END FOR
```

**BUG #2 — Condición de bug**

```pascal
FUNCTION isBugCondition_2(path)
  INPUT: path of type string (input to CLI _run_scan)
  OUTPUT: boolean

  resolved ← normalize(abspath(expanduser(path)))
  RETURN pointsToSensitiveSystemDir(resolved)
END FUNCTION
```

```pascal
// Property: Fix Checking - Paridad de validación CLI/API
FOR ALL path WHERE isBugCondition_2(path) DO
  ASSERT CLI _run_scan'(path) rechaza el escaneo con exit code distinto de 0
         Y no descubre ni analiza archivos del directorio sensible
END FOR
```

**BUG #3 — Condición de bug**

```pascal
FUNCTION isBugCondition_3(displayPath)
  INPUT: displayPath of type string (path mostrado en tablas del CLI)
  OUTPUT: boolean

  // La ruta tiene más de 3 componentes usando el separador nativo,
  // pero no contiene "/", por lo que el acortado actual no se aplica.
  RETURN componentCount(displayPath, os.sep) > 3 AND NOT contains(displayPath, "/")
END FUNCTION
```

```pascal
// Property: Fix Checking - Acortado de ruta multiplataforma
FOR ALL displayPath WHERE isBugCondition_3(displayPath) DO
  shown ← shortenPath'(displayPath)
  ASSERT componentCount(shown, os.sep) <= 3
         Y shown conserva los últimos componentes de la ruta original
END FOR
```

**Preservación (común a los tres bugs)**

```pascal
// Property: Preservation Checking
FOR ALL path WHERE NOT isBugCondition_1(path)
                AND NOT isBugCondition_2(path)
                AND NOT isBugCondition_3(path) DO
  ASSERT F(path) = F'(path)
END FOR
```

Es decir: para rutas Unix sensibles (que ya se bloqueaban), rutas normales de usuario, y rutas cortas de display, el comportamiento fijo debe ser idéntico al original.

> **Definiciones:** `F` = código original (sin arreglar); `F'` = código arreglado. `pointsToSensitiveSystemDir` incluye tanto los directorios sensibles Unix ya existentes como los directorios sensibles de Windows a añadir.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN el sistema operativo es Windows Y se envía a `POST /api/scan` un path que apunta a un directorio sensible del sistema (ej. `C:\Windows`, `C:\Windows\System32`, `C:\Program Files`, `C:\ProgramData`) THEN el sistema acepta el path como válido y responde `200 OK`, permitiendo el escaneo del directorio del sistema.

1.2 WHEN `_validate_path` compara el path resuelto contra `SENSITIVE_PATHS` en Windows THEN el sistema nunca encuentra coincidencia porque `SENSITIVE_PATHS` solo contiene rutas de estilo Unix y la comparación usa concatenación con `/`, que no aparece en rutas de Windows con backslash.

1.3 WHEN se ejecuta el CLI (`python cli.py scan <ruta_sensible>`) sobre un directorio sensible del sistema (en cualquier plataforma) THEN el CLI valida solo existencia y tipo de directorio y procede a descubrir y analizar archivos sin aplicar la protección de directorios sensibles.

1.4 WHEN el CLI muestra el reporte de texto en Windows con rutas que tienen más de 3 componentes THEN el sistema muestra la ruta absoluta completa y larga en las tablas "Top Offenders" y "All files" porque el acortado depende del separador `/`.

### Expected Behavior (Correct)

2.1 WHEN se envía a `POST /api/scan` un path que apunta a un directorio sensible del sistema, en Windows o en Unix/Mac THEN el sistema SHALL rechazar la petición con `HTTPException` de estado `403` sin iniciar el escaneo.

2.2 WHEN `_validate_path` compara el path resuelto contra la lista de directorios sensibles THEN el sistema SHALL usar comparación de rutas multiplataforma (normalización con `pathlib.Path` y `os.path.normcase`, y relación de contención de rutas en lugar de concatenación de strings con `/`), reconociendo tanto directorios sensibles Unix como de Windows.

2.3 WHEN se ejecuta el CLI sobre un directorio sensible del sistema THEN el CLI SHALL rechazar el escaneo con un mensaje de error y un código de salida distinto de cero, usando la misma lógica de validación de paths sensibles que la API (lógica compartida).

2.4 WHEN el CLI muestra el reporte de texto con rutas que tienen más de 3 componentes, en Windows o en Unix/Mac THEN el sistema SHALL mostrar la ruta acortada a sus últimos componentes usando un separador de rutas multiplataforma (`os.sep`/`pathlib`).

### Unchanged Behavior (Regression Prevention)

3.1 WHEN en Unix/Mac se envía a `POST /api/scan` un path que apunta a un directorio sensible Unix ya cubierto (`/etc`, `/proc`, `/sys`, etc.) THEN el sistema SHALL CONTINUE TO rechazar la petición con estado `403`.

3.2 WHEN se envía a `POST /api/scan` un path de usuario normal, existente, legible y no sensible THEN el sistema SHALL CONTINUE TO validarlo, descubrir archivos y crear el job de escaneo con el mismo flujo actual (rate limiting, límite de 5000 archivos, SSE, badge, export, historial de git).

3.3 WHEN se envía a `POST /api/scan` un path vacío, inexistente, que no es directorio, o sin permiso de lectura THEN el sistema SHALL CONTINUE TO devolver los mismos errores actuales (`400` vacío, `404` no encontrado, `400` no directorio, `403` sin permiso de lectura).

3.4 WHEN el CLI se ejecuta sobre un directorio de usuario normal no sensible THEN el CLI SHALL CONTINUE TO descubrir archivos, analizar, agregar resultados y mostrar el reporte (texto o JSON) con el mismo comportamiento actual, incluida la opción `--fail-below`.

3.5 WHEN el CLI muestra el reporte de texto con rutas que ya son cortas (3 componentes o menos) THEN el sistema SHALL CONTINUE TO mostrar la ruta sin modificar.

3.6 WHEN en Unix/Mac el CLI muestra rutas largas con separador `/` THEN el sistema SHALL CONTINUE TO acortarlas a los últimos 3 componentes como lo hace actualmente.
