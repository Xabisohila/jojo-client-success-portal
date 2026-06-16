from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings as app_config
from app.core.deps import get_current_user
from app.routers import auth, leads, assessments, proposals, dashboard, clients, customer_success, renewals
from app.routers import settings as settings_router

app = FastAPI(
    title=app_config.app_name,
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.azurewebsites.net"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

protected = [Depends(get_current_user)]

app.include_router(auth.router, prefix="/api/v1")
app.include_router(leads.router, prefix="/api/v1", dependencies=protected)
app.include_router(assessments.router, prefix="/api/v1", dependencies=protected)
app.include_router(proposals.router, prefix="/api/v1", dependencies=protected)
app.include_router(dashboard.router, prefix="/api/v1", dependencies=protected)
app.include_router(clients.router, prefix="/api/v1", dependencies=protected)
app.include_router(customer_success.router, prefix="/api/v1", dependencies=protected)
app.include_router(renewals.router, prefix="/api/v1", dependencies=protected)
app.include_router(settings_router.router, prefix="/api/v1", dependencies=protected)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": app_config.app_name}
