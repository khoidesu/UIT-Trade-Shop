from __future__ import annotations

import json
import os
from pathlib import Path

from pymongo import MongoClient


def main() -> None:
    mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    mongo_db = os.getenv("MONGODB_DB", "shopee_clone")
    mongo_collection = os.getenv("MONGODB_COLLECTION", "products")

    client = MongoClient(mongo_uri)
    collection = client[mongo_db][mongo_collection]
    collection.create_index("id", unique=True)

    seed_path = Path(__file__).parent / "seed_products.json"
    items = json.loads(seed_path.read_text(encoding="utf-8"))

    upserts = 0
    for item in items:
      collection.update_one({"id": item["id"]}, {"$set": item}, upsert=True)
      upserts += 1

    print(f"Seeded {upserts} products into {mongo_db}.{mongo_collection}")


if __name__ == "__main__":
    main()

