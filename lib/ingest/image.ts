/**
 * Describe an image using a vision-capable LLM.
 * Returns extracted text and description.
 */
export async function extractImageText(
  imageUrl: string,
  apiKey: string,
  provider: "openai" | "google" = "openai"
): Promise<string> {
  if (provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract ALL text visible in this image. Also provide a detailed description of the image content. Format as:\n\n## Extracted Text\n[text here]\n\n## Description\n[description here]",
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI vision API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  // Google Gemini fallback
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Extract ALL text visible in this image. Also provide a detailed description of the image content.",
              },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: imageUrl, // base64 for Gemini
                },
              },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini vision API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}
