import os
from fastapi import FastAPI
from sqlalchemy import create_engine
import httpx

app = FastAPI(title="account-service")

# shares user_db with user-service -> shared-database risk
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://pg-user:5432/user_db")
engine = create_engine(DATABASE_URL)

BILLING = os.getenv("BILLING_SERVICE_URL", "http://billing-service:8090")


@app.get("/account")
def account():
    return {"plan": "pro"}


# overlaps with user-service account read paths
@app.get("/accounts/{id}")
def get_account(id: str):
    with engine.connect() as c:
        return {"id": id}


@app.put("/account/profile")
def update_profile(body: dict):
    return {"ok": True}


@app.delete("/accounts/{id}")
def delete_account(id: str):
    # different cascade behavior than user-service DELETE /user/{id}
    with httpx.Client() as client:
        client.post(f"{BILLING}/refunds", json={"account": id})
    return {"ok": True}
