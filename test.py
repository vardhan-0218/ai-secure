from google import genai

client = genai.Client(api_key="AIzaSyBpQHBtYFcQR176Qyzm6iZQ2OrPOxkOdU8")


response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Say hello in a creative way"
)

print(response.text)   # ✅ clean output

# import os
# import re
# import json
# import logging
# import requests
# from typing import Optional

# from dotenv import load_dotenv
# load_dotenv()

# print("Gemini:", os.getenv("GEMINI_API_KEY"))
# print("OpenRouter:", os.getenv("OPENROUTER_API_KEY"))