import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Body parser
app.use(express.json());

// Shared Gemini Client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

// 1. API: Analyze Today's Study Activity
app.post('/api/ai/analyze-day', async (req, res) => {
  try {
    const { sessions, dailyGoalHours, totalHours, pendingTasks, weakAreas } = req.body;

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API key is not configured in environment.'
      });
    }

    const prompt = `You are an expert GATE Exam Mentor analyzing today's study activity for a serious GATE aspirant.
Here is the actual data:
- Today's Total Study Time: ${totalHours} hours
- Daily Study Target / Goal: ${dailyGoalHours || 10} hours
- Logged Sessions: ${JSON.stringify(sessions || [])}
- Pending Planning Tasks: ${JSON.stringify(pendingTasks || [])}
- Known Weak Areas: ${JSON.stringify(weakAreas || [])}

Provide a concise, practical, highly focused review in JSON format containing:
1. "summary": A 2-3 sentence honest evaluation of today's study distribution and discipline.
2. "timeAnalysis": How effectively time was spent across theory vs problem solving vs revisions.
3. "observations": 2-3 constructive bullet points highlighting good progress or areas where study time was low or imbalanced.
4. "suggestedFocus": Practical next action items for tomorrow based on pending tasks and weak areas.

No generic cliches. Base all advice strictly on the provided real numbers.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            timeAnalysis: { type: Type.STRING },
            observations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            suggestedFocus: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['summary', 'timeAnalysis', 'observations', 'suggestedFocus']
        }
      }
    });

    const text = response.text?.trim() || '{}';
    const parsedData = JSON.parse(text);
    return res.json(parsedData);
  } catch (err: any) {
    console.error('Error analyzing study day:', err);
    return res.status(500).json({
      error: `Failed to analyze study day: ${err.message || 'Unknown error'}`
    });
  }
});

// Setup Vite in Dev or Static Serve in Prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GATE GPMS Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
