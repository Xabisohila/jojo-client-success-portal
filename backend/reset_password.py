"""
Emergency password reset script — run from the backend/ directory.

Usage:
    python reset_password.py <new_password>
    python reset_password.py <new_password> --email someone@example.com
"""
import sys
import argparse

from app.config import settings
from app.core.security import hash_password
from app.database import SessionLocal
from app.models.user import User, UserCredential
from datetime import datetime, timezone


def reset_password(email: str, new_password: str) -> None:
    if len(new_password) < 8:
        print("Error: password must be at least 8 characters.")
        sys.exit(1)

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"Error: no user found with email '{email}'.")
            sys.exit(1)

        creds = db.query(UserCredential).filter(UserCredential.user_id == user.id).first()
        if creds:
            creds.password_hash = hash_password(new_password)
            creds.updated_at = datetime.now(timezone.utc)
        else:
            db.add(UserCredential(user_id=user.id, password_hash=hash_password(new_password)))

        db.commit()
        print(f"Password reset for {email} ({user.full_name}).")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reset a portal user's password.")
    parser.add_argument("new_password", help="New password to set")
    parser.add_argument("--email", default="admin@jojo.internal", help="User email (default: admin@jojo.internal)")
    args = parser.parse_args()
    reset_password(args.email, args.new_password)
