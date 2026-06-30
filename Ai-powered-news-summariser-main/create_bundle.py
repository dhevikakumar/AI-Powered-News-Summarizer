import os

# Configuration
OUTPUT_FILE = r"c:\Users\Arularasi S\.gemini\antigravity\brain\a56c3dac-ec20-491e-8d2e-4eb268f91184\codebase_bundle.md"
BASE_DIR = r"c:\Users\Arularasi S\Downloads\ai notes summariser"

# Files to include
FILES_TO_BUNDLE = [
    # Backend
    "backend/main.py",
    "backend/auth.py",
    "backend/summarizer.py",
    "backend/requirements.txt",
    # Frontend Config
    "frontend/package.json",
    "frontend/vite.config.js",
    "frontend/index.html",
    # Frontend Source
    "frontend/src/main.jsx",
    "frontend/src/App.jsx",
    "frontend/src/App.css",
    "frontend/src/index.css"
]

def create_bundle():
    with open(OUTPUT_FILE, "w", encoding="utf-8") as outfile:
        outfile.write("# AI Notes Summariser - Complete Codebase\n\n")
        outfile.write("This document contains the source code for the AI Notes Summariser application.\n\n")
        
        for relative_path in FILES_TO_BUNDLE:
            full_path = os.path.join(BASE_DIR, relative_path)
            
            if not os.path.exists(full_path):
                print(f"Warning: File not found: {full_path}")
                continue
                
            outfile.write(f"## {relative_path}\n\n")
            
            # Determine language for syntax highlighting
            ext = os.path.splitext(relative_path)[1]
            lang = "text"
            if ext == ".py": lang = "python"
            elif ext == ".js" or ext == ".jsx": lang = "javascript"
            elif ext == ".css": lang = "css"
            elif ext == ".html": lang = "html"
            elif ext == ".json": lang = "json"
            
            outfile.write(f"```{lang}\n")
            
            try:
                with open(full_path, "r", encoding="utf-8") as infile:
                    outfile.write(infile.read())
            except Exception as e:
                outfile.write(f"Error reading file: {e}")
                
            outfile.write("\n```\n\n")
            print(f"Added {relative_path}")

    print(f"Successfully created bundle at: {OUTPUT_FILE}")

if __name__ == "__main__":
    create_bundle()
