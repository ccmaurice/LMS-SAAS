import { z } from "zod";

const generatedQuestionSchema = z.object({
  type: z.enum(["MCQ", "SHORT_ANSWER", "LONG_ANSWER", "TRUE_FALSE"]),
  prompt: z.string().min(1).max(20_000),
  points: z.number().min(0.5).max(100).optional(),
  correctAnswer: z.string().max(2000).optional().nullable(),
  markingScheme: z.string().max(20_000).optional().nullable(),
  options: z
    .object({
      choices: z.array(
        z.object({
          id: z.string(),
          text: z.string(),
          correct: z.boolean(),
        }),
      ),
    })
    .optional(),
});

const responseSchema = z.object({
  questions: z.array(generatedQuestionSchema).max(30),
});

export type GeneratedAssessmentQuestion = z.infer<typeof generatedQuestionSchema>;

function mockQuestions(topic: string): GeneratedAssessmentQuestion[] {
  return [
    {
      type: "MCQ",
      prompt: `[Mock] According to the document, what is the main idea of "${topic.slice(0, 40)}…"?`,
      points: 2,
      options: {
        choices: [
          { id: "a", text: "Option A (placeholder)", correct: true },
          { id: "b", text: "Option B", correct: false },
          { id: "c", text: "Option C", correct: false },
        ],
      },
    },
    {
      type: "TRUE_FALSE",
      prompt: "[Mock] The source material supports this statement.",
      points: 1,
      correctAnswer: "true",
    },
  ];
}

export async function generateAssessmentQuestionsFromExcerpt(excerpt: string): Promise<GeneratedAssessmentQuestion[]> {
  const trimmed = excerpt.trim().slice(0, 48_000);
  const key = process.env.GOOGLE_AI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!key || trimmed.length < 20) {
    return mockQuestions(trimmed.slice(0, 80) || "untitled");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`;
  const body = {
    contents: [
      {
        parts: [
          {
            text: `You are an assessment author. From the following document excerpt, create 4–8 exam questions.
Use types: MCQ (4 choices, exactly one correct: true), SHORT_ANSWER (with correctAnswer string), TRUE_FALSE (correctAnswer "true" or "false"), LONG_ANSWER (with a short markingScheme rubric).
Use LaTeX in prompts where math appears: wrap display math in $$...$$.
Return JSON ONLY with shape: {"questions":[...]} — no markdown fences.

Document:
---
${trimmed}
---
`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.35,
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return mockQuestions("API error");
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return mockQuestions("empty response");
    const parsed = JSON.parse(text) as unknown;
    const out = responseSchema.safeParse(parsed);
    if (!out.success || out.data.questions.length === 0) {
      return mockQuestions("parse");
    }
    return out.data.questions;
  } catch {
    return mockQuestions("exception");
  }
}
