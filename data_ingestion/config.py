import os
from dataclasses import dataclass


def _env_or(value: str, env_var: str) -> str:
    return value or os.environ.get(env_var, "")


@dataclass
class Config:
    # ---- Qdrant Cloud (required) ----
    QDRANT_URL: str = ""       # e.g. "https://xxxxxxxx.us-east.aws.cloud.qdrant.io:6333"
    QDRANT_API_KEY: str = ""

    # ---- Hugging Face (only needed if ai4bharat/MSMARCO-XI turns out to be gated) ----
    HF_TOKEN: str = ""

    # ---- Dataset / collection ----
    DATASET_NAME: str = "ai4bharat/MSMARCO-XI"
    COLLECTION_NAME: str = "msmarco_xi"

    # ---- Storage ----
    # Put this on mounted Google Drive, not /content — Colab wipes /content on
    # disconnect, and checkpoints/artifacts must survive that (see spec §8, §11).
    DRIVE_DIR: str = "/content/drive/MyDrive/msmarco_xi_ingestion"

    # ---- Run controls ----
    SEED: int = 42
    SHUFFLE_BUFFER: int = 10_000
    EMBED_BATCH_SIZE: int = 64
    UPSERT_BATCH_SIZE: int = 128
    TARGET_POINTS: int = 290_000
    MAX_POINTS: int = 340_000

    def __post_init__(self):
        self.QDRANT_URL = _env_or(self.QDRANT_URL, "QDRANT_URL")
        self.QDRANT_API_KEY = _env_or(self.QDRANT_API_KEY, "QDRANT_API_KEY")
        self.HF_TOKEN = _env_or(self.HF_TOKEN, "HF_TOKEN")

    def validate(self):
        missing = [n for n, v in [("QDRANT_URL", self.QDRANT_URL),
                                   ("QDRANT_API_KEY", self.QDRANT_API_KEY)] if not v]
        if missing:
            raise ValueError(
                f"Missing required config values: {missing}. "
                f"Paste them into CFG in config.py, or set them as env vars / Colab secrets."
            )


CFG = Config(
    QDRANT_URL="",
    QDRANT_API_KEY="",
    HF_TOKEN="",
)
