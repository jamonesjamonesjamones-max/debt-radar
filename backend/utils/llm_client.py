"""
LLM Client — Cliente para Ollama (LLM local).
"""

import httpx
from typing import Optional

OLLAMA_BASE = "http://localhost:11434"


async def check_ollama_status() -> dict:
    """
    Verifica si Ollama está corriendo y qué modelos tiene disponibles.
    Retorna dict con: available (bool), models (list), error (str)
    """
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(f"{OLLAMA_BASE}/api/tags")
            if response.status_code == 200:
                data = response.json()
                models = [m["name"] for m in data.get("models", [])]
                return {"available": True, "models": models}
            return {"available": False, "error": f"HTTP {response.status_code}"}
    except httpx.ConnectError:
        return {"available": False, "error": "Ollama no está corriendo"}
    except Exception as e:
        return {"available": False, "error": str(e)[:100]}


async def get_refactor_suggestion(
    code_snippet: str,
    violation_type: str,
    violation_context: str = "",
    model: str = "llama3.2",
) -> dict:
    """
    Pide a Ollama una sugerencia de refactorización.
    Retorna dict con: suggestion (str), model (str), error (str)
    """
    system_prompt = """Eres un refactorizador experto de código. 
Tu trabajo es sugerir cómo mejorar el código dado para eliminar la violación detectada.
Reglas:
- Solo devuelve código refactorizado, sin explicaciones largas
- Mantén la misma funcionalidad
- Usa las mejores prácticas del lenguaje
- Si es un TODO/FIXME, implementa la solución
- Si es nesting excesivo, extrae funciones o usa early returns
- Si es magic number, crea una constante con nombre descriptivo"""

    type_explanation = {
        "max_nesting": "Anidamiento excesivo (>4 niveles). Extrae funciones, usa early returns, o simplifica la lógica.",
        "magic_number": "Magic number detectado. Crea una constante con nombre descriptivo.",
        "todo": "TODO/FIXME pendiente. Implementa la solución o propón el código que reemplace el TODO.",
    }

    user_prompt = f"""Violação: {violation_type}
{type_explanation.get(violation_type, '')}

Contexto: {violation_context}

Código:
```
{code_snippet}
```

Refactoriza este código para eliminar la violación:"""

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{OLLAMA_BASE}/api/generate",
                json={
                    "model": model,
                    "system": system_prompt,
                    "prompt": user_prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "num_predict": 500,
                    },
                },
            )

            if response.status_code == 200:
                data = response.json()
                return {
                    "suggestion": data.get("response", "").strip(),
                    "model": model,
                }
            return {"suggestion": "", "error": f"HTTP {response.status_code}"}

    except httpx.ConnectError:
        return {"suggestion": "", "error": "Ollama no está corriendo"}
    except Exception as e:
        return {"suggestion": "", "error": str(e)[:100]}
