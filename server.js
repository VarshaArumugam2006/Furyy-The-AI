const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static frontend files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Helper to determine if an API key is configured
function isApiKeyConfigured() {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim() !== '' && key !== 'YOUR_GEMINI_API_KEY_HERE');
}

/**
 * GET /api/status
 * Returns system status, available models, and whether the API key is configured.
 */
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    isKeyConfigured: isApiKeyConfigured(),
    model: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
    botName: 'FURYY : THE AI',
    availableModels: [
      { id: 'gemini-flash-lite-latest', name: '⚡ FURYY Turbo (1s Ultra-Fast)', isFast: true },
      { id: 'gemini-3.5-flash-lite', name: '⚡ FURYY Balanced (2s Fast)', isFast: true },
      { id: 'gemini-3.8-flash', name: '🧠 FURYY Deep Reasoning (Detailed)', isFast: false }
    ]
  });
});

/**
 * POST /api/chat
 * Handles incoming chat messages with support for real-time streaming (SSE)
 * and ultra-fast non-blocking completions.
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, stream = true } = req.body;
    const requestedModel = req.body.model;

    // 1. Input validation
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        error: 'Message cannot be empty. Please enter a question or prompt.'
      });
    }

    // 2. Key validation
    if (!isApiKeyConfigured()) {
      return res.status(500).json({
        error: 'Gemini API Key is not configured! Please open your .env file, add your GEMINI_API_KEY, and restart the server.'
      });
    }

    const apiKey = process.env.GEMINI_API_KEY.trim();
    // Default to the ultra-fast gemini-flash-lite-latest model
    let modelName = requestedModel || process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';

    // 3. Format conversation history for Gemini multi-turn support
    let contents = [];

    if (Array.isArray(history) && history.length > 0) {
      const recentHistory = history.slice(-8);
      for (const item of recentHistory) {
        if (!item.text || typeof item.text !== 'string') continue;
        const role = (item.role === 'model' || item.role === 'assistant' || item.role === 'bot')
          ? 'model'
          : 'user';
        contents.push({
          role: role,
          parts: [{ text: item.text }]
        });
      }
    }

    // Append current user message
    contents.push({
      role: 'user',
      parts: [{ text: message.trim() }]
    });

    const systemInstruction = 'You are FURYY : THE AI, an ultra-fast, intelligent, and friendly AI assistant. Provide concise, clear, and direct answers using clean Markdown. When providing programming code, always specify the language in code blocks.';

    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    // 4. Handle Real-Time Streaming Mode (SSE) for instant word-by-word delivery
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      try {
        const streamResult = await ai.models.generateContentStream({
          model: modelName,
          contents: contents,
          config: { systemInstruction }
        });

        let accumulated = '';
        for await (const chunk of streamResult) {
          const chunkText = chunk.text;
          if (chunkText) {
            accumulated += chunkText;
            res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
          }
        }

        res.write(`data: ${JSON.stringify({ done: true, model: modelName, reply: accumulated })}\n\n`);
        return res.end();

      } catch (streamErr) {
        console.warn(`Streaming with ${modelName} encountered an error:`, streamErr.message);

        // Fallback to gemini-flash-lite-latest if requested model had an issue
        if (modelName !== 'gemini-flash-lite-latest') {
          try {
            modelName = 'gemini-flash-lite-latest';
            const fallbackStream = await ai.models.generateContentStream({
              model: modelName,
              contents: contents,
              config: { systemInstruction }
            });
            let accumulated = '';
            for await (const chunk of fallbackStream) {
              const chunkText = chunk.text;
              if (chunkText) {
                accumulated += chunkText;
                res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
              }
            }
            res.write(`data: ${JSON.stringify({ done: true, model: modelName, reply: accumulated })}\n\n`);
            return res.end();
          } catch (fbErr) {
            res.write(`data: ${JSON.stringify({ error: fbErr.message })}\n\n`);
            return res.end();
          }
        }

        res.write(`data: ${JSON.stringify({ error: streamErr.message })}\n\n`);
        return res.end();
      }
    }

    // 5. Non-streaming fast completion fallback
    const response = await ai.models.generateContent({
      model: modelName,
      contents: contents,
      config: { systemInstruction }
    });

    let replyText = typeof response.text === 'function' ? response.text() : response.text;
    if (!replyText && response.candidates?.[0]?.content?.parts) {
      replyText = response.candidates[0].content.parts.map(p => p.text).join('');
    }

    return res.json({
      success: true,
      reply: (replyText || '').trim(),
      model: modelName,
      botName: 'FURYY : THE AI'
    });

  } catch (error) {
    console.error('Error in /api/chat:', error);
    const errorMessage = error.message || error.toString();

    if (errorMessage.includes('API_KEY_INVALID') || errorMessage.includes('API key not valid')) {
      return res.status(401).json({
        error: 'Invalid Gemini API key. Please check the GEMINI_API_KEY in your .env file.'
      });
    }

    if (errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota') || errorMessage.includes('429')) {
      return res.status(429).json({
        error: 'FURYY rate limit or quota exceeded. Please wait a moment and try again.'
      });
    }

    return res.status(500).json({
      error: `FURYY Error: ${errorMessage.length > 200 ? errorMessage.slice(0, 200) + '...' : errorMessage}`
    });
  }
});

// Universal fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  const keyConfigured = isApiKeyConfigured();
  console.log('\n========================================================');
  console.log('⚡ FURYY : THE AI Server is successfully running!');
  console.log(`🌐 Local URL:        http://localhost:${PORT}`);
  console.log(`🚀 Default Model:    ${process.env.GEMINI_MODEL || 'gemini-flash-lite-latest'} (Ultra-Fast ⚡)`);
  console.log(`🔑 API Key Status:  ${keyConfigured ? '✅ Configured' : '⚠️ Missing (Please update .env)'}`);
  console.log('========================================================\n');
});
