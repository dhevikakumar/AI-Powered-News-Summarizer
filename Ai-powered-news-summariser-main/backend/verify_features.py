
import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def test_features():
    print("Testing AI Summariser Enhancements...")
    
    # 1. Register/Login
    username = "testuser_advanced"
    password = "password123"
    
    # Try register
    try:
        requests.post(f"{BASE_URL}/auth/register", json={
            "username": username,
            "email": "test@example.com",
            "password": password
        })
    except:
        pass # User might exist

    # Login
    print("Logging in...")
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "username": username,
        "password": password
    })
    
    if resp.status_code != 200:
        print("Login failed:", resp.text)
        return

    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    text = "Photosynthesis is a process used by plants and other organisms to convert light energy into chemical energy. This chemical energy is stored in carbohydrate molecules, such as sugars, which are synthesized from carbon dioxide and water. The name comes from the Greek phōs, 'light', and sunthesis, 'putting together'."

    # 2. Test Flashcards
    print("\nTesting Flashcard Generation...")
    resp = requests.post(f"{BASE_URL}/generate/flashcards", json={"text": text}, headers=headers)
    if resp.status_code == 200:
        cards = resp.json()
        print(f"✅ Generated {len(cards)} flashcards:")
        for card in cards:
            print(f"  Q: {card['question']}")
            print(f"  A: {card['answer']}")
    else:
        print("❌ Flashcard generation failed:", resp.text)

    # 3. Test Keywords
    print("\nTesting Keyword Extraction...")
    resp = requests.post(f"{BASE_URL}/extract/keywords", json={"text": text}, headers=headers)
    if resp.status_code == 200:
        keywords = resp.json()["keywords"]
        print(f"✅ Extracted Keywords: {', '.join(keywords)}")
    else:
        print("❌ Keyword extraction failed:", resp.text)

if __name__ == "__main__":
    try:
        test_features()
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to server. Make sure 'uvicorn backend.main:app' is running.")
