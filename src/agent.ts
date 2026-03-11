import { DurableObject } from "cloudflare:workers";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface SessionState {
  jd: string;
  questions: string[];
  history: Message[];
  createdAt: number;
}

interface Env {
  AI: Ai;
}

export class InterviewSession extends DurableObject<Env> {
  private state: SessionState = {
    jd: "",
    questions: [],
    history: [],
    createdAt: Date.now(),
  };

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Rehydrate from storage on wake
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<SessionState>("state");
      if (stored) this.state = stored;
    });
  }

  private async save() {
    await this.ctx.storage.put("state", this.state);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // POST /init  { jd: string }
    if (path === "/init" && request.method === "POST") {
      const { jd } = await request.json<{ jd: string }>();
      this.state.jd = jd;
      this.state.questions = [];
      this.state.history = [];
      this.state.createdAt = Date.now();

      // Generate questions via Workers AI
      const systemPrompt = `You are an expert technical interviewer. Given a job description, generate exactly 7 interview questions: 3 behavioral (STAR-format friendly), 2 technical (specific to the role), and 2 situational. Format your response as a JSON array of strings. Only output the JSON array, nothing else.`;

      const aiResp = await this.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Job Description:\n${jd}` },
        ],
        max_tokens: 1024,
      });

      let questions: string[] = [];
      try {
        const raw = (aiResp as { response: string }).response.trim();
        // Extract JSON array robustly
        const match = raw.match(/\[[\s\S]*\]/);
        if (match) questions = JSON.parse(match[0]);
      } catch {
        questions = ["Tell me about yourself.", "Why are you interested in this role?", "Describe a challenging project."];
      }

      this.state.questions = questions;
      this.state.history = [
        {
          role: "assistant",
          content: `I've analyzed the job description and prepared **${questions.length} interview questions** for you.\n\nHere they are:\n\n${questions.map((q, i) => `**${i + 1}.** ${q}`).join("\n\n")}\n\n---\nWhen you're ready, pick a question number and I'll walk you through it. Or just start answering and I'll give you feedback!`,
        },
      ];

      await this.save();
      return Response.json({ questions, message: this.state.history[0].content });
    }

    // POST /chat  { message: string }
    if (path === "/chat" && request.method === "POST") {
      const { message } = await request.json<{ message: string }>();

      this.state.history.push({ role: "user", content: message });

      const systemPrompt = `You are an expert interview coach helping a candidate prepare for a job interview.

Job Description the candidate is preparing for:
${this.state.jd}

Interview questions you generated:
${this.state.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Your role:
- If the candidate gives an answer to an interview question, evaluate it using the STAR framework (Situation, Task, Action, Result). Point out what was strong and what was missing. Be specific and actionable.
- If the candidate asks to practice a specific question, re-state it clearly and encourage them.
- If the candidate asks for tips, give concise, practical advice.
- Keep responses focused and conversational. Use markdown formatting.
- Remember all previous answers in this session to avoid repetition and to track their progress.`;

      const messages: Message[] = [
        { role: "system", content: systemPrompt },
        ...this.state.history,
      ];

      const aiResp = await this.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages,
        max_tokens: 1024,
      });

      const reply = (aiResp as { response: string }).response;
      this.state.history.push({ role: "assistant", content: reply });
      await this.save();

      return Response.json({ reply });
    }

    // GET /state
    if (path === "/state" && request.method === "GET") {
      return Response.json(this.state);
    }

    // DELETE /reset
    if (path === "/reset" && request.method === "DELETE") {
      this.state = { jd: "", questions: [], history: [], createdAt: Date.now() };
      await this.save();
      return Response.json({ ok: true });
    }

    return new Response("Not found", { status: 404 });
  }
}
