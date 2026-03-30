/**
 * AI helpers — uses OpenAI when OPENAI_API_KEY is set; otherwise deterministic mock text.
 */

export async function suggestMarkingScheme(topic: string, questionPrompt?: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You write concise marking rubrics for teachers (bullets: full credit, partial, zero). No preamble.",
            },
            {
              role: "user",
              content: `Topic: ${topic}\nQuestion: ${questionPrompt ?? "(not provided)"}\nSuggest a short marking scheme.`,
            },
          ],
          max_tokens: 400,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return text;
      }
    } catch {
      /* fall through */
    }
  }

  return [
    `Mock rubric for “${topic.slice(0, 80)}${topic.length > 80 ? "…" : ""}”:`,
    "• Full points: addresses all parts with clear reasoning.",
    "• Partial: relevant but incomplete or minor errors.",
    "• No credit: off-topic or blank.",
  ].join("\n");
}

export type LongAnswerAiGrade = { score: number; feedback: string };

/**
 * Scores a long-form response against a rubric. Uses OpenAI when configured; otherwise a deterministic mock.
 */
export async function gradeLongAnswerWithAi(input: {
  questionPrompt: string;
  markingScheme: string;
  studentAnswer: string;
  maxPoints: number;
}): Promise<LongAnswerAiGrade> {
  const { questionPrompt, markingScheme, studentAnswer, maxPoints } = input;
  const key = process.env.OPENAI_API_KEY;

  if (key && studentAnswer.trim().length > 0) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You grade student answers. Reply with JSON only: {"score": number between 0 and ${maxPoints} (inclusive), "feedback": string under 400 chars, constructive}.`,
            },
            {
              role: "user",
              content: `Rubric:\n${markingScheme}\n\nQuestion:\n${questionPrompt}\n\nStudent answer:\n${studentAnswer}`,
            },
          ],
          max_tokens: 500,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const raw = data.choices?.[0]?.message?.content?.trim();
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { score?: unknown; feedback?: unknown };
            const score = typeof parsed.score === "number" ? parsed.score : Number(parsed.score);
            const feedback = typeof parsed.feedback === "string" ? parsed.feedback.trim() : "";
            if (Number.isFinite(score) && feedback) {
              const clamped = Math.min(maxPoints, Math.max(0, score));
              return { score: clamped, feedback };
            }
          } catch {
            /* invalid JSON */
          }
        }
      }
    } catch {
      /* fall through */
    }
  }

  const ratio = studentAnswer.trim() ? 0.55 + (studentAnswer.length % 7) * 0.05 : 0;
  const score = Math.round(Math.min(maxPoints, Math.max(0, ratio * maxPoints)));
  return {
    score,
    feedback:
      studentAnswer.trim().length === 0
        ? "No answer submitted — mock auto-grade."
        : "Mock AI feedback: your response would be reviewed against the rubric; connect each rubric bullet explicitly.",
  };
}
