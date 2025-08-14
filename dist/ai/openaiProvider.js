"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIProvider = void 0;
class OpenAIProvider {
    constructor(apiKey, model) {
        this.apiKey = apiKey;
        this.model = model;
    }
    async generateCommitMessage(systemPrompt, userPrompt, fewShotMessages) {
        const response = await globalThis.fetch("https://api.openai.com/v1/chat/completions", {
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
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content?.trim() ?? "";
        return content.replace(/^"|"$/g, "");
    }
}
exports.OpenAIProvider = OpenAIProvider;
//# sourceMappingURL=openaiProvider.js.map