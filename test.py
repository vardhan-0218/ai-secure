from google import genai

client = genai.Client(api_key="AIzaSyAebk-LJd657wrR5iIaTRlN5WVGIiuyWHs")


response = client.models.generate_content(
    model="gemini-pro",
    contents="Say hello in a creative way"
)

print(response.text)   # ✅ clean output