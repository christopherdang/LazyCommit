import { fetch as undiciFetch } from "undici";

export class OpenAIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateCommitMessage(
    systemPrompt: string,
    userPrompt: string,
    fewShotMessages?: { role: "user" | "assistant" | "system"; content: string }[]
  ): Promise<string> {
    const response = await undiciFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        max_tokens: 200,
        messages: [
          { role: "system", content: systemPrompt },
          ...(fewShotMessages ?? []),
          { role: "user", content: userPrompt }
        ]
      })
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${text}`);
    }
    const data: any = await response.json();
    const content: string = data?.choices?.[0]?.message?.content?.trim() ?? "";
    return content.replace(/^"|"$/g, "");
  }
}

