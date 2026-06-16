import uuid

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.security import COOKIE_NAME, decode_access_token
from app.database import get_db
from app.models.user import User


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(401, "Not authenticated.")
    user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(401, "Session expired or invalid. Please log in again.")
    user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(401, "Account not found or inactive.")
    return user
