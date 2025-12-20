from google import genai
import os

client = genai.Client(api_key=os.getenv("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"))

response = client.models.generate_content(
    model="gemini-1.5-flash",
    contents="Explain Unreal Engine 5 in simple terms."
)

print(response.text)


