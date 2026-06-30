"""
FastAPI Backend for AI Notes Summariser.
With User Authentication and Search History.
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

from summarizer import summarize_text, generate_flashcards, extract_keywords
from auth import (
    UserCreate, UserLogin, Token, User, HistoryItem,
    register_user, authenticate_user, get_current_user,
    add_history_item, get_user_history, clear_user_history, delete_history_item
)

app = FastAPI(
    title="AI Notes Summariser API",
    description="An API to summarize text using NLP techniques with user authentication.",
    version="2.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TextRequest(BaseModel):
    text: str
    num_sentences: Optional[int] = 3


class SummaryResponse(BaseModel):
    original_length: int
    summary_length: int
    summary: str
    flashcards: Optional[List[dict]] = []
    keywords: Optional[List[str]] = []


class FlashcardResponse(BaseModel):
    question: str
    answer: str


class KeywordResponse(BaseModel):
    keywords: List[str]


# ==================== Public Endpoints ====================

@app.get("/")
def read_root():
    return {"message": "Welcome to the AI Notes Summariser API!", "version": "2.0.0"}


# ==================== Auth Endpoints ====================

@app.post("/auth/register")
def register(user: UserCreate):
    """Register a new user."""
    return register_user(user)


@app.post("/auth/login", response_model=Token)
def login(user: UserLogin):
    """Login and get access token."""
    return authenticate_user(user)


@app.get("/auth/me", response_model=User)
def get_me(username: str = Depends(get_current_user)):
    """Get current user info."""
    from auth import load_users
    users = load_users()
    user_data = users.get(username)
    return User(username=user_data["username"], email=user_data["email"])


# ==================== Summarize Endpoints (Protected) ====================

@app.post("/summarize/text", response_model=SummaryResponse)
def summarize_from_text(
    request: TextRequest,
    username: str = Depends(get_current_user)
):
    """
    Summarizes text provided in the request body.
    Requires authentication.
    """
    if not request.text:
        raise HTTPException(status_code=400, detail="No text provided.")
    
    summary = summarize_text(request.text, request.num_sentences)
    
    # Save to history
    add_history_item(username, request.text, summary, request.num_sentences)
    
    return SummaryResponse(
        original_length=len(request.text),
        summary_length=len(summary),
        summary=summary
    )


@app.post("/summarize/file", response_model=SummaryResponse)
async def summarize_from_file(
    file: UploadFile = File(...),
    num_sentences: int = Form(3),
    username: str = Depends(get_current_user)
):
    """
    Summarizes text from an uploaded file (.txt).
    Requires authentication.
    """
    if not file.filename.endswith('.txt'):
        raise HTTPException(status_code=400, detail="Only .txt files are supported.")
    
    try:
        contents = await file.read()
        text = contents.decode('utf-8')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not read file: {e}")
    
    if not text:
        raise HTTPException(status_code=400, detail="File is empty.")

    summary = summarize_text(text, num_sentences)
    flashcards = generate_flashcards(text)
    keywords = extract_keywords(text)
    
    # Save to history
    add_history_item(username, text, summary, num_sentences)

    return SummaryResponse(
        original_length=len(text),
        summary_length=len(summary),
        summary=summary,
        flashcards=flashcards,
        keywords=keywords
    )


@app.post("/generate/flashcards", response_model=List[FlashcardResponse])
def create_flashcards(
    request: TextRequest,
    username: str = Depends(get_current_user)
):
    """
    Generates flashcards from text.
    Requires authentication.
    """
    if not request.text:
        raise HTTPException(status_code=400, detail="No text provided.")
        
    flashcards = generate_flashcards(request.text)
    return flashcards


@app.post("/extract/keywords", response_model=KeywordResponse)
def get_keywords(
    request: TextRequest,
    username: str = Depends(get_current_user)
):
    """
    Extracts keywords from text.
    Requires authentication.
    """
    if not request.text:
        raise HTTPException(status_code=400, detail="No text provided.")
        
    keywords = extract_keywords(request.text)
    return KeywordResponse(keywords=keywords)


# ==================== History Endpoints ====================

@app.get("/history", response_model=List[HistoryItem])
def get_history(username: str = Depends(get_current_user)):
    """Get user's summarization history."""
    return get_user_history(username)


@app.delete("/history")
def clear_history(username: str = Depends(get_current_user)):
    """Clear all history for the current user."""
    return clear_user_history(username)


@app.delete("/history/{item_id}")
def delete_history(item_id: int, username: str = Depends(get_current_user)):
    """Delete a specific history item."""
    return delete_history_item(username, item_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
