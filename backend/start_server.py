import uvicorn

# Development launcher with hot-reload scoped to the backend directory.
# This avoids restarting the server when unrelated files (scripts, configs)
# in the project root are modified.
uvicorn.run(
    "main:app",
    host="127.0.0.1",
    port=8000,
    reload=True,
    reload_dirs=["backend"],
    log_level="info",
)
