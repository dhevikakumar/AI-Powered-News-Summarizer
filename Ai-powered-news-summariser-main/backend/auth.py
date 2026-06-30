"""
Authentication Module for AI Notes Summariser.
Handles user registration, login, and JWT token management.
"""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import json
import os

# JWT Configuration
SECRET_KEY = "ai-notes-summariser-secret-key-2026"  # In production, use environment variable
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Password hashing
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# Security scheme
security = HTTPBearer()

# Simple file-based storage (in production, use a database)
USERS_FILE = os.path.join(os.path.dirname(__file__), "users.json")
HISTORY_FILE = os.path.join(os.path.dirname(__file__), "history.json")


# Models
class UserCreate(BaseModel):
    username: str
    email: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    username: str


class User(BaseModel):
    username: str
    email: str


class HistoryItem(BaseModel):
    id: int
    original_text: str
    summary: str
    original_length: int
    summary_length: int
    num_sentences: int
    created_at: str


# Helper functions
def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r') as f:
            return json.load(f)
    return {}


def save_users(users):
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f, indent=2)


def load_history():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, 'r') as f:
            return json.load(f)
    return {}


def save_history(history):
    with open(HISTORY_FILE, 'w') as f:
        json.dump(history, f, indent=2)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Extract username from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    users = load_users()
    if username not in users:
        raise credentials_exception
    
    return username


def register_user(user: UserCreate):
    users = load_users()
    
    if user.username in users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Check if email exists
    for u in users.values():
        if u.get("email") == user.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
    
    hashed_password = get_password_hash(user.password)
    users[user.username] = {
        "username": user.username,
        "email": user.email,
        "password": hashed_password,
        "created_at": datetime.utcnow().isoformat()
    }
    save_users(users)
    
    return {"message": "User registered successfully", "username": user.username}


def authenticate_user(user: UserLogin):
    users = load_users()
    
    if user.username not in users:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    stored_user = users[user.username]
    if not verify_password(user.password, stored_user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return Token(access_token=access_token, token_type="bearer", username=user.username)


def add_history_item(username: str, original_text: str, summary: str, num_sentences: int):
    history = load_history()
    
    if username not in history:
        history[username] = []
    
    # Create new history item
    item_id = len(history[username]) + 1
    new_item = {
        "id": item_id,
        "original_text": original_text[:500] + "..." if len(original_text) > 500 else original_text,
        "summary": summary,
        "original_length": len(original_text),
        "summary_length": len(summary),
        "num_sentences": num_sentences,
        "created_at": datetime.utcnow().isoformat()
    }
    
    # Add to beginning of list (most recent first)
    history[username].insert(0, new_item)
    
    # Keep only last 50 items per user
    history[username] = history[username][:50]
    
    save_history(history)
    return new_item


def get_user_history(username: str):
    history = load_history()
    return history.get(username, [])


def clear_user_history(username: str):
    history = load_history()
    if username in history:
        history[username] = []
        save_history(history)
    return {"message": "History cleared successfully"}


def delete_history_item(username: str, item_id: int):
    history = load_history()
    
    if username not in history:
        raise HTTPException(status_code=404, detail="No history found")
    
    original_length = len(history[username])
    history[username] = [item for item in history[username] if item["id"] != item_id]
    
    if len(history[username]) == original_length:
        raise HTTPException(status_code=404, detail="History item not found")
    
    save_history(history)
    return {"message": "History item deleted successfully"}
