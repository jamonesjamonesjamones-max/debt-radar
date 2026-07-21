"""
DebtRadar - Backend Entry Point
FastAPI + CORS + SSE + Uvicorn
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routes import router as api_router

app = FastAPI(
    title="DebtRadar",
    description="Auditor forense de salud de código y deuda técnica",
    version="1.0.0",
)

# CORS restringido a localhost:5173 (frontend Vite)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Agrega headers de seguridad a todas las respuestas."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


# Registrar rutas de la API
app.include_router(api_router, prefix="/api")


@app.get("/")
def healthcheck():
    """Endpoint raíz de healthcheck."""
    return JSONResponse(
        content={
            "status": "ok",
            "service": "DebtRadar",
            "version": "1.0.0",
        }
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
    )
