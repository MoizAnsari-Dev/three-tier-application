#!/usr/bin/env python3
"""
AI Task Processing Worker
Consumes jobs from Redis queue and processes them asynchronously.
"""

import json
import logging
import os
import signal
import sys
import time
from datetime import datetime, timezone

import redis
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure

load_dotenv()

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("worker")

# ── Config ───────────────────────────────────────────────────────────────────
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD") or None
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/three-tier-application")
TASK_QUEUE = "task_queue"
POLL_TIMEOUT = 5  # seconds for BLPOP blocking timeout

# ── Globals ──────────────────────────────────────────────────────────────────
running = True


def handle_shutdown(signum, frame):
    global running
    log.info(f"Signal {signum} received — shutting down worker gracefully")
    running = False


signal.signal(signal.SIGTERM, handle_shutdown)
signal.signal(signal.SIGINT, handle_shutdown)


# ── Operations ───────────────────────────────────────────────────────────────
def process_operation(operation: str, input_text: str) -> str:
    if operation == "uppercase":
        return input_text.upper()
    elif operation == "lowercase":
        return input_text.lower()
    elif operation == "reverse":
        return input_text[::-1]
    elif operation == "word_count":
        count = len(input_text.split())
        return f"Word count: {count}"
    else:
        raise ValueError(f"Unknown operation: {operation}")


# ── Connections ──────────────────────────────────────────────────────────────
def connect_redis(retries: int = 10, delay: int = 3) -> redis.Redis:
    for attempt in range(1, retries + 1):
        try:
            client = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                password=REDIS_PASSWORD,
                decode_responses=True,
                socket_connect_timeout=5,
            )
            client.ping()
            log.info(f"Redis connected at {REDIS_HOST}:{REDIS_PORT}")
            return client
        except redis.ConnectionError as e:
            log.warning(f"Redis connection attempt {attempt}/{retries} failed: {e}")
            if attempt < retries:
                time.sleep(delay)
    log.error("Could not connect to Redis after multiple attempts — exiting")
    sys.exit(1)


def connect_mongo(retries: int = 10, delay: int = 3) -> MongoClient:
    for attempt in range(1, retries + 1):
        try:
            client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
            client.admin.command("ping")
            log.info("MongoDB connected")
            return client
        except (ConnectionFailure, OperationFailure) as e:
            log.warning(f"MongoDB connection attempt {attempt}/{retries} failed: {e}")
            if attempt < retries:
                time.sleep(delay)
    log.error("Could not connect to MongoDB after multiple attempts — exiting")
    sys.exit(1)


# ── Task Processing ───────────────────────────────────────────────────────────
def process_task(task_id: str, operation: str, input_text: str, tasks_col) -> None:
    from bson import ObjectId

    oid = ObjectId(task_id)
    now = datetime.now(timezone.utc)

    def add_log(message: str, level: str = "info"):
        tasks_col.update_one(
            {"_id": oid},
            {"$push": {"logs": {"timestamp": datetime.now(timezone.utc), "message": message, "level": level}}},
        )

    try:
        log.info(f"Processing task {task_id}: operation={operation}")

        # Mark as running
        tasks_col.update_one(
            {"_id": oid},
            {"$set": {"status": "running", "startedAt": now}},
        )
        add_log(f"Worker started processing: operation={operation}")

        # Simulate a small processing delay for realism
        time.sleep(0.5)

        # Process operation
        result = process_operation(operation, input_text)
        add_log(f"Operation '{operation}' completed successfully")

        # Mark as success
        tasks_col.update_one(
            {"_id": oid},
            {
                "$set": {
                    "status": "success",
                    "result": result,
                    "completedAt": datetime.now(timezone.utc),
                }
            },
        )
        add_log("Task completed with status: success")
        log.info(f"Task {task_id} completed successfully")

    except Exception as exc:
        log.error(f"Task {task_id} failed: {exc}")
        tasks_col.update_one(
            {"_id": oid},
            {
                "$set": {
                    "status": "failed",
                    "errorMessage": str(exc),
                    "completedAt": datetime.now(timezone.utc),
                }
            },
        )
        add_log(f"Task failed with error: {exc}", level="error")


# ── Main Loop ─────────────────────────────────────────────────────────────────
def main():
    log.info("🚀 AI Task Worker starting...")

    r = connect_redis()
    mongo_client = connect_mongo()
    db = mongo_client.get_database()
    tasks_col = db["tasks"]

    log.info(f"Listening on queue: {TASK_QUEUE}")

    while running:
        try:
            # BLPOP blocks until a job is available (or timeout)
            result = r.blpop(TASK_QUEUE, timeout=POLL_TIMEOUT)
            if result is None:
                continue  # timeout — check running flag

            _, raw_job = result
            job = json.loads(raw_job)

            task_id = job.get("taskId")
            operation = job.get("operation")
            input_text = job.get("inputText", "")

            if not task_id or not operation:
                log.warning(f"Malformed job skipped: {raw_job}")
                continue

            process_task(task_id, operation, input_text, tasks_col)

        except redis.RedisError as e:
            log.error(f"Redis error: {e} — retrying in 5s")
            time.sleep(5)
            # Attempt reconnect
            try:
                r = connect_redis(retries=5, delay=2)
            except SystemExit:
                break

        except Exception as e:
            log.error(f"Unexpected error in main loop: {e}")
            time.sleep(1)

    log.info("Worker shut down cleanly.")
    mongo_client.close()


if __name__ == "__main__":
    main()
