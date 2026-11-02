import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import router as api_router
from app.db.session import engine, Base
from app.core.config import RECORDINGS_DIR

# Create database tables if they do not exist
Base.metadata.create_all(bind=engine)

os.makedirs(RECORDINGS_DIR, exist_ok=True)

app = FastAPI(
    title="AI Mock Interview Platform API",
    description="Dedicated Standalone AI Interviewer and Nursing Competency Assessment System",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "AI Mock Interview Platform"}

