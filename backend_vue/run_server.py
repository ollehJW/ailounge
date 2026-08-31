from __future__ import annotations

import os

import uvicorn
from dotenv import load_dotenv


load_dotenv()


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=os.getenv("BACKEND_HOST", "0.0.0.0"),
        port=int(os.getenv("BACKEND_PORT", "9004")),
    )
