from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import get_current_user
from app.core.security import COOKIE_NAME, create_access_token, verify_password
from app.database import get_db
from app.models.user import User, UserCredential
from app.schemas.auth import LoginRequest, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    creds = db.query(UserCredential).filter(UserCredential.user_id == user.id).first() if user else None
    if not user or not creds or not verify_password(payload.password, creds.password_hash):
        raise HTTPException(401, "Incorrect email or password.")
    if not user.is_active:
        raise HTTPException(401, "This account has been deactivated.")

    token = create_access_token(str(user.id))
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=not settings.debug,
        max_age=settings.access_token_expire_minutes * 60,
    )
    return user


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
