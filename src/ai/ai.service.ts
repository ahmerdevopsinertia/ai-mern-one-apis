import { Injectable } from '@nestjs/common';
import { PythonShell } from 'python-shell';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'path';

@Injectable()
export class AIService {

  RAG_PROJECT_PATH: string;

  constructor(
    private httpService: HttpService,
    private config: ConfigService
  ) {
    const basePath = this.config.get('RAG_PROJECT_PATH');

    // Resolve to absolute path
    this.RAG_PROJECT_PATH = resolve(process.cwd(), basePath);

    console.log('Resolved RAG Path:', this.RAG_PROJECT_PATH);

    // const __filename = fileURLToPath(import.meta.url);
    // const __dirname = dirname(__filename);
    // this.RAG_PROJECT_PATH = join(__dirname, '../../../../AI/AI-MERN-ChatBot/edu-staff-rag');

    // console.log('Resolved paths:', {
    //   __filename,
    //   __dirname,
    //   RAG_PROJECT_PATH: this.RAG_PROJECT_PATH
    // });
  }

  private validateResponse(response: string): string {
    // First check for blocked phrases
    const blockedPhrases = [
      "fire you", "no-tolerance",
      "immediately", "strict policy",
      "must comply or"
    ];

    if (blockedPhrases.some(phrase =>
      response.toLowerCase().includes(phrase.toLowerCase())
    )) {
      return "For detailed policy questions, please contact HR directly.";
    }

    // Then check response quality
    const hasBulletPoints = (response.match(/-/g) || []).length >= 2;
    const hasReference = /reference:/i.test(response);
    const hasDepartment = /department:/i.test(response);

    if (!hasBulletPoints || !hasReference) {
      return "I'm having trouble retrieving the full policy details. " +
        "The key point is: " +
        response.split('\n')[0];
    }

    return response;
  }

  async handleQuery(message: string) {

    if (!await this.checkLLMHealth()) {
      return {
        reply: "Our AI service is currently unavailable",
        sources: []
      };
    }

    // 1. Call Python RAG
    const ragResult = await this.queryPythonRAG(message);
    console.log("RAG Context:", ragResult.context); // Debug log

    if (ragResult.error) throw new Error(ragResult.error);


    // 2. Call llama-server
    const llmResponse = await this.queryLLM(message, ragResult.context);
    // const llmResponse = await this.withRetry(() => this.queryLLM(message, ragResult.context));
    console.log("LLM Response:", llmResponse); // Debug log

    return {
      reply: this.validateResponse(llmResponse),
      sources: ragResult.sources
    };
  }

  private async queryPythonRAG(query: string): Promise<{ context?: string; sources?: string[]; error?: string }> {
    // const RAG_PROJECT_PATH = '/Users/ahmersaeed/Documents/Others/AI/AI-MERN-ChatBot/edu-staff-rag';

    // const RAG_PROJECT_PATH = path.join(__dirname, '../../../../AI/AI-MERN-ChatBot/edu-staff-rag');

    return new Promise((resolve) => {

      const options = {
        pythonPath: `${this.RAG_PROJECT_PATH}/new_venv/bin/python`, // Direct path
        args: [JSON.stringify(query)],
        env: {
          ...process.env,
          PINECONE_API_KEY: process.env.PINECONE_API_KEY
        }
      };

      // const shell = new PythonShell(join(this.RAG_PROJECT_PATH, 'rag_handler.py'), options);
      const shell = new PythonShell(`${this.RAG_PROJECT_PATH}/rag_handler.py`, options);
      let fullResponse = '';

      shell.on('message', (message: string) => {
        fullResponse += message;
      });

      shell.on('close', () => {
        console.log('Raw Python Response:', fullResponse); // Debug log
        try {
          resolve(JSON.parse(fullResponse));
        } catch (e) {
          resolve({ error: `Invalid JSON: ${fullResponse}` });
        }
      });

      shell.on('error', (err) => {
        resolve({ error: err.message });
      });

      // shell.end((err) => {
      //   if (err) resolve({ error: err.message });
      // });
    });
  }

  private async queryLLM(query: string, context?: string) {
    try {
      const prompt = this.buildPrompt(query, context);

      // Add debug logs right after creating the prompt
      console.log("=== LLM DEBUG INFO ===");
      console.log("Prompt length (chars):", prompt.length);
      console.log("Estimated prompt tokens:", Math.ceil(prompt.length / 4));
      console.log("First 200 chars:", prompt.substring(0, 200) + (prompt.length > 200 ? "..." : ""));

      // const response = await this.httpService.post(
      //   `${process.env.LLM_SERVER_URL}:${process.env.LLM_SERVER_PORT}${process.env.LLM_API_ENDPOINT_COMPLETION}`,
      //   {
      //     prompt: prompt,
      //     n_predict: 500,  // Increased from 256
      //     temperature: 0.2,
      //     top_k: 30,
      //     top_p: 0.85,
      //     stop: ["\n\n", "6.", "RESPONSE:"], // Stop after 5 points
      //     repeat_penalty: 1.5, // Reduce repetition,
      //     repeat_last_n: 0,  // Prevent repetition
      //     mirostat: 2,       // Better response quality
      //     mirostat_tau: 5.0,
      //     mirostat_eta: 0.1
      //   },
      //   // { timeout: 3000 } // 10 second timeout
      // ).toPromise();

      const response = await firstValueFrom(this.httpService.post(
        `${process.env.LLM_SERVER_URL}:${process.env.LLM_SERVER_PORT}${process.env.LLM_API_ENDPOINT_COMPLETION}`,
        {
          prompt: prompt,
          n_predict: 500,  // Increased from 256
          // temperature: 0.2,
          temperature: 0.1,
          top_k: 30,
          top_p: 0.85,
          stop: ["</s>", "[INST]", "\n\n"], // Mistral-specific stops
          // stop: ["\n\n", "6.", "RESPONSE:"], // Stop after 5 points
          repeat_penalty: 1.5, // Reduce repetition,
          repeat_last_n: 0,  // Prevent repetition
          mirostat: 2,       // Better response quality
          mirostat_tau: 5.0,
          mirostat_eta: 0.1
        },
        // { timeout: 3000 } // 10 second timeout
      ));

      // Add these debug logs:
      console.log("Prompt length (chars):", prompt.length);
      console.log("Estimated prompt tokens:", Math.ceil(prompt.length / 4));

      if (!response) {
        throw new Error('No response received from the LLM server.');
      }

      const { data } = response;

      // Enhanced token logging
      console.log("=== LLM RESPONSE INFO ===");
      console.log("Actual tokens used:", data?.tokens_predicted);
      console.log("Response length:", data?.content?.length);
      console.log("First 100 chars of response:", data?.content?.substring(0, 100));

      console.log("Actual tokens used:", data?.tokens_predicted);

      return this.cleanResponse(data?.content); // <-- Apply cleaning here
      // return this.formatResponse(data?.content.trim() || "I couldn't generate a response.");
    }
    catch (error) {
      console.error('LLM Query Error:', error);
      return this.withRetry(() => this.queryLLM(query, context));
    }
  }

  private buildPrompt(query: string, context?: string): string {
    //   return `
    // [INSTRUCTIONS]
    // Answer the HR policy question using ONLY the provided context.
    // Structure your response:
    // 1. Direct answer (1-2 sentences)
    // 2. Key policy points (bulleted)
    // 3. Policy reference

    // [CONTEXT]
    // ${context?.trim() || "No specific policies available"}

    // [QUESTION]
    // ${query.trim()}

    // [ANSWER]
    // `.trim();

    // more sample

    // if (context) {
    //   context = context.split('\n').slice(0, 10).join('\n'); // Take first 10 lines
    //   console.log("Context limited to first 10 lines");
    // }

    // if (context && context.length > 2000) {
    //   context = context.substring(0, 2000) + "... [truncated]";
    //   console.log("Context truncated to 2000 chars");
    // }

    // const promptTemplate02 = `<s>[INST] <<SYS>>Use these policy excerpts to answer. Cite sources.<</SYS>>

    // POLICIES:
    // ${context || "No relevant policies found"}

    // QUESTION: ${query.trim()}

    // FORMAT:
    // - Start with "According to policy:"
    // - Use bullet points
    // - End with reference like [Policy ABC101] [/INST]</s>`;

    // // Add this line BEFORE return
    // console.log("Final Prompt:", promptTemplate02.replace(/</g, "\\<")); // Escape HTML for logging

    // return promptTemplate02;

    // 1. Smarter context selection - keep policy sections intact
    if (context) {
      // Prioritize keeping complete policy sections
      const sections = context.split('\n\n'); // Split by double newlines
      context = sections.slice(0, 3).join('\n\n'); // Keep first 3 complete sections
      console.log("Context limited to first 3 sections");
    }

    // 2. More generous length limit for policy docs
    if (context && context.length > 3000) {
      context = context.substring(0, 3000) + "... [truncated]";
      console.log("Context truncated to 3000 chars");
    }

    // 3. Enhanced prompt structure
    const prompt = `<s>[INST] <<SYS>>You are an HR policy expert. Answer in this exact format:
  1. SUMMARY: 1-sentence answer
  2. POLICY DETAILS:
     - Bullet 1
     - Bullet 2
  3. REFERENCE: [Section X.Y] or [Policy ABC123]
  <</SYS>>

  RELEVANT POLICY EXCERPTS:
  ${context || "No matching policy found"}

  QUESTION: ${query.trim()} [/INST]</s>`;

    console.log("Context Preview:", context?.substring(0, 100) + "...");
    console.log("Prompt Token Estimate:", Math.ceil(prompt.length / 3.5)); // Approx tokens

    return prompt;
  }

  private formatResponse(raw: string): string {
    // Clean up LLM output
    return raw
      .replace(/<answer>|<bullet points>|<reference>/g, '')
      .replace(/\n+/g, '\n')
      .trim();
  }

  async checkLLMHealth() {
    try {
      // Debug env vars first
      console.log('Current environment:', {
        NODE_ENV: process.env.NODE_ENV,
        LLM_SERVER_URL: process.env.LLM_SERVER_URL,
        LLM_SERVER_PORT: process.env.LLM_SERVER_PORT,
        LLM_API_ENDPOINT_HEALTH: process.env.LLM_API_ENDPOINT_HEALTH
      });

      const baseUrl = process.env.LLM_SERVER_URL || 'http://localhost';
      const port = process.env.LLM_SERVER_PORT || '8080';
      const endpoint = process.env.LLM_API_ENDPOINT_HEALTH || '/health';

      // Remove duplicate slashes
      const healthCheckUrl = `${baseUrl}:${port}${endpoint}`.replace(/([^:]\/)\/+/g, '$1');

      console.log('Final health check URL:', healthCheckUrl);

      const response = await firstValueFrom(
        this.httpService.get(healthCheckUrl, { timeout: 5000 })
      );

      return response?.data?.status === "ok";
    } catch (error) {
      console.error('Health check failed:', error.message);
      return false;
    }
  }

  private async withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0) {
        await new Promise(res => setTimeout(res, 1000));
        return this.withRetry(fn, retries - 1);
      }
      throw error;
    }
  }

  private cleanResponse(raw: string): string {
    if (!raw) return "I couldn't generate a response.";

    // Remove duplicate numbered points
    const lines = raw.split('\n');
    const uniqueLines: string[] = [];
    const seenPoints = new Set();

    for (const line of lines) {
      const pointMatch = line.match(/^\d+\./);
      if (pointMatch) {
        const pointText = line.replace(/^\d+\.\s*/, '').trim().toLowerCase();
        if (seenPoints.has(pointText)) continue;
        seenPoints.add(pointText);
      }
      uniqueLines.push(line);
    }

    // Enforce maximum 5 points
    const filteredLines = uniqueLines.filter((line, index) => {
      const pointNum = parseInt(line.match(/^(\d+)\./)?.[1] || "0");
      return pointNum <= 5 || !line.match(/^\d+\./);
    });

    return filteredLines.join('\n').trim();
  }
}