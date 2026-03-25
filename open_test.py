import requests
import time

API_KEY = "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"
url = "https://openrouter.ai/api/v1/chat/completions"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost",
    "X-Title": "test-app"
}

models = [
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "google/gemma-3n-e4b-it:free",
    "meta-llama/llama-3-8b-instruct:free",
    "openchat/openchat-7b:free"
]

for model in models:
    print(f"Trying: {model}")
    
    data = {
        "model": model,
        "messages": [
            {"role": "user", "content": "Say hello"}
        ]
    }

    response = requests.post(url, headers=headers, json=data)

    if response.status_code == 200:
        result = response.json()
        print("✅ SUCCESS:", model)
        print(result["choices"][0]["message"]["content"])
        break
    else:
        print("❌ Failed:", model)
        time.sleep(2)