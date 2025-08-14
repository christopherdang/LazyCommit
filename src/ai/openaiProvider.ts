export class OpenAIProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private extraHeaders: Record<string, string>;

  constructor(apiKey: string, model: string, baseUrl: string = "https://api.openai.com/v1", extraHeaders: Record<string, string> = {}) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.extraHeaders = { ...extraHeaders };
  }

  async generateCommitMessage(
    systemPrompt: string,
    userPrompt: string,
    fewShotMessages?: { role: "user" | "assistant" | "system"; content: string }[]
  ): Promise<string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.extraHeaders
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await (globalThis as any).fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
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

