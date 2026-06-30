"""
Core NLP Summarization Logic using NLTK.

This module implements extractive summarization using:
1. Tokenization
2. Stop-word removal
3. Word frequency calculation
4. Sentence scoring
"""

import nltk
from nltk.corpus import stopwords
from nltk.tokenize import sent_tokenize, word_tokenize
from heapq import nlargest

# Ensure NLTK data is available
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt', quiet=True)

try:
    nltk.data.find('tokenizers/punkt_tab')
except LookupError:
    nltk.download('punkt_tab', quiet=True)

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords', quiet=True)


def summarize_text(text: str, num_sentences: int = 3) -> str:
    """
    Summarizes the given text by extracting the most important sentences.

    Args:
        text: The input text to summarize.
        num_sentences: The number of sentences to include in the summary.

    Returns:
        A string containing the summarized text.
    """
    if not text or not text.strip():
        return "Please provide some text to summarize."

    # Tokenize sentences
    sentences = sent_tokenize(text)

    if len(sentences) <= num_sentences:
        return text  # Already short enough

    # Tokenize words and remove stop words
    stop_words = set(stopwords.words('english'))
    words = word_tokenize(text.lower())
    
    # Calculate word frequencies (excluding stop words and non-alphabetic tokens)
    word_frequencies = {}
    for word in words:
        if word.isalnum() and word not in stop_words:
            word_frequencies[word] = word_frequencies.get(word, 0) + 1

    # Normalize frequencies
    if not word_frequencies:
        return sentences[0] if sentences else "Could not generate summary."
        
    max_frequency = max(word_frequencies.values())
    for word in word_frequencies:
        word_frequencies[word] /= max_frequency

    # Score sentences based on word frequencies
    sentence_scores = {}
    for sentence in sentences:
        sentence_words = word_tokenize(sentence.lower())
        score = 0
        word_count = 0
        for word in sentence_words:
            if word in word_frequencies:
                score += word_frequencies[word]
                word_count += 1
        # Normalize by word count to avoid bias towards long sentences
        if word_count > 0:
            sentence_scores[sentence] = score / word_count

    # Get the top N sentences
    summary_sentences = nlargest(num_sentences, sentence_scores, key=sentence_scores.get)

    # Re-order sentences by their original appearance
    summary_sentences_ordered = [s for s in sentences if s in summary_sentences]

    return ' '.join(summary_sentences_ordered)


import re

def generate_flashcards(text: str) -> list:
    """
    Generates flashcards (Q&A) from the text using Regex patterns.
    """
    if not text:
        return []
        
    sentences = sent_tokenize(text)
    flashcards = []
    
    # Regex patterns for definitions
    # Group 1 = Subject, Group 2 = Connector (ignored), Group 3 = Definition
    # We catch: "X is a Y", "X is an Y", "X refers to Y", "X means Y"
    # \b ensures word boundaries
    patterns = [
        (r"(?i)(.+?)\s+(is\s+(?:an?|the)?|are)\s+(.+)", "What is {}?", "What are {}?"),
        (r"(?i)(.+?)\s+(refers? to|means?|signif(?:ies|y))\s+(.+)", "What does {} mean?", "What does {} mean?")
    ]

    for sentence in sentences:
        sentence = sentence.strip()
        # Filter out very short or very long sentences
        if len(sentence.split()) < 3 or len(sentence.split()) > 60:
            continue
            
        # Check if it looks like a question
        if sentence.endswith("?"):
            continue

        # Normalize whitespace (handle newlines within a single "sentence")
        clean_sentence = " ".join(sentence.split())

        matched = False
        for pattern, singular_q, plural_q in patterns:
            match = re.match(pattern, clean_sentence)
            if match:
                subject = match.group(1).strip()
                connector = match.group(2).strip().lower()
                definition = match.group(3).strip()
                
                # Heuristics to clean up subject
                # If subject is too long, it's probably not a simple definition
                if len(subject.split()) > 13:
                    continue
                
                # If subject starts with "For example", "However", etc., skip or clean
                ignore_starts = ["for example", "however", "therefore", "additionally", "introduction"]
                if any(subject.lower().startswith(x) for x in ignore_starts):
                    continue

                # Clean up "Introduction " prefix if present (common in copy-pasted text)
                if subject.lower().startswith("introduction"):
                    subject = subject[12:].strip()

                # Choose template
                q_template = plural_q if connector == "are" else singular_q
                
                question = q_template.format(subject)
                flashcards.append({"question": question, "answer": sentence})
                matched = True
                break
        
        if matched:
            continue
            
    return flashcards


def extract_keywords(text: str, num_keywords: int = 5) -> list:
    """
    Extracts key terms from the text.
    """
    if not text:
        return []

    stop_words = set(stopwords.words('english'))
    words = word_tokenize(text.lower())
    
    # Filter for nouns and adjectives, longer than 2 chars
    candidates = [
        word for word in words 
        if word.isalnum() and word not in stop_words and len(word) > 2
    ]
    
    # Frequency distribution
    freq_dist = nltk.FreqDist(candidates)
    
    # Get top N keywords
    keywords = [word for word, count in freq_dist.most_common(num_keywords)]
    
    return keywords
