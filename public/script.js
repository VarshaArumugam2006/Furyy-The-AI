/**
 * ==============================================================================
 * FURYY : THE AI - Ultra-Fast Streaming Engine & Real-Time Thinking
 * ==============================================================================
 * Delivers sub-second initial responses through Server-Sent Events (SSE) streaming,
 * multi-model speed switching, safe markdown parsing, and conversation persistence.
 */

const STORAGE_KEY = 'furyy_the_ai_chat_history_v3';

// Application State
let chatMessages = [];
let isGenerating = false;
let thinkingInterval = null;

// DOM Elements
const chatBody = document.getElementById('chat-body');
const messagesList = document.getElementById('messages-list');
const welcomeScreen = document.getElementById('welcome-screen');
const typingIndicator = document.getElementById('typing-indicator');
const thinkingStageText = document.getElementById('thinking-stage-text');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const clearChatBtn = document.getElementById('clear-chat-btn');
const clearChatSidebarBtn = document.getElementById('clear-chat-sidebar-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const modelSelect = document.getElementById('model-select');

// Sidebar & Mobile Elements
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const menuToggleBtn = document.getElementById('menu-toggle-btn');
const sidebarCloseBtn = document.getElementById('sidebar-close-btn');

// Status Elements
const statusPulse = document.getElementById('status-pulse');
const statusTitle = document.getElementById('status-title');
const statusSub = document.getElementById('status-sub');
const headerStatusText = document.getElementById('header-status-text');
const toastContainer = document.getElementById('toast-container');

// Fast Thinking Status Messages
const THINKING_STAGES = [
  '⚡ FURYY is thinking...',
  '🧠 Processing with ultra-fast neural speed...',
  '✨ Generating response...'
];

// ==============================================================================
// 1. Initialization
// ==============================================================================
document.addEventListener('DOMContentLoaded', () => {
  loadChatHistory();
  checkServerStatus();
  setupEventListeners();
  autoResizeTextarea();
});

async function checkServerStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('Status endpoint failed');
    const data = await res.json();

    if (data.isKeyConfigured) {
      statusPulse.style.backgroundColor = '#10b981';
      statusPulse.style.boxShadow = '0 0 10px #10b981';
      statusTitle.textContent = 'FURYY Turbo Ready';
      statusSub.textContent = data.model || 'gemini-flash-lite-latest';
      headerStatusText.textContent = 'Online • Ultra-Fast Stream Active ⚡';
      if (modelSelect && data.model) {
        modelSelect.value = data.model;
      }
    } else {
      statusPulse.style.backgroundColor = '#f59e0b';
      statusPulse.style.boxShadow = '0 0 10px #f59e0b';
      statusTitle.textContent = 'API Key Missing';
      statusSub.textContent = 'Update .env file';
      headerStatusText.textContent = '⚠️ API Key Not Set (Check .env)';
      showToast('API key is missing in .env file.', 'error');
    }
  } catch (err) {
    statusPulse.style.backgroundColor = '#ef4444';
    statusPulse.style.boxShadow = '0 0 10px #ef4444';
    statusTitle.textContent = 'Server Offline';
    statusSub.textContent = 'Port 3000 unreachable';
    headerStatusText.textContent = 'Offline • Server disconnected';
  }
}

function setupEventListeners() {
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSendMessage();
  });

  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  userInput.addEventListener('input', () => {
    autoResizeTextarea();
    toggleSendButtonState();
  });

  if (modelSelect) {
    modelSelect.addEventListener('change', () => {
      const modeName = modelSelect.options[modelSelect.selectedIndex].text;
      showToast(`Switched to ${modeName}`, 'info');
      statusSub.textContent = modelSelect.value;
    });
  }

  if (clearChatBtn) clearChatBtn.addEventListener('click', confirmAndClearChat);
  if (clearChatSidebarBtn) clearChatSidebarBtn.addEventListener('click', confirmAndClearChat);
  if (newChatBtn) newChatBtn.addEventListener('click', confirmAndClearChat);

  if (menuToggleBtn) menuToggleBtn.addEventListener('click', openSidebar);
  if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

  document.querySelectorAll('[data-prompt]').forEach((el) => {
    el.addEventListener('click', () => {
      const promptText = el.getAttribute('data-prompt');
      if (promptText) {
        userInput.value = promptText;
        autoResizeTextarea();
        toggleSendButtonState();
        closeSidebar();
        handleSendMessage();
      }
    });
  });
}

function openSidebar() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('active');
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('active');
}

function autoResizeTextarea() {
  userInput.style.height = 'auto';
  const newHeight = Math.min(userInput.scrollHeight, 180);
  userInput.style.height = `${newHeight}px`;
}

function toggleSendButtonState() {
  const hasText = userInput.value.trim().length > 0;
  sendBtn.disabled = !hasText || isGenerating;
}

// ==============================================================================
// 2. Chat History Management (localStorage)
// ==============================================================================
function loadChatHistory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      chatMessages = JSON.parse(saved);
      if (Array.isArray(chatMessages) && chatMessages.length > 0) {
        welcomeScreen.style.display = 'none';
        chatMessages.forEach((msg) => renderMessageElement(msg, false));
        scrollToBottom(false);
        return;
      }
    }
  } catch (e) {
    console.error('Failed to load chat history from localStorage', e);
  }

  welcomeScreen.style.display = 'block';
}

function saveChatHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chatMessages));
  } catch (e) {
    console.error('Failed to save chat history to localStorage', e);
  }
}

function confirmAndClearChat() {
  if (chatMessages.length === 0) {
    showToast('Conversation is already empty.', 'info');
    return;
  }

  const confirmed = window.confirm('Are you sure you want to clear this entire conversation with FURYY?');
  if (!confirmed) return;

  chatMessages = [];
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}

  messagesList.innerHTML = '';
  welcomeScreen.style.display = 'block';
  userInput.value = '';
  autoResizeTextarea();
  toggleSendButtonState();
  closeSidebar();
  showToast('Chat history cleared.', 'success');
}

// ==============================================================================
// 3. Fast Streaming Message Dispatch & Thinking Management
// ==============================================================================
async function handleSendMessage() {
  const rawText = userInput.value.trim();
  if (!rawText || isGenerating) return;

  welcomeScreen.style.display = 'none';

  // 1. Create and render user message
  const userMsg = {
    id: 'msg_' + Date.now(),
    role: 'user',
    text: rawText,
    timestamp: formatCurrentTime()
  };

  chatMessages.push(userMsg);
  saveChatHistory();
  renderMessageElement(userMsg, true);

  userInput.value = '';
  autoResizeTextarea();
  isGenerating = true;
  toggleSendButtonState();

  // 2. Show thinking indicator
  startThinkingProcess();
  scrollToBottom(true);

  // 3. Prepare bot response container for real-time streaming
  const botMsgId = 'msg_' + (Date.now() + 1);
  const botRow = createStreamingBotRow(botMsgId);
  const bubbleContent = botRow.querySelector('.bubble-content');
  messagesList.appendChild(botRow);

  const selectedModel = modelSelect ? modelSelect.value : 'gemini-flash-lite-latest';
  const historyPayload = chatMessages.slice(-6).map((m) => ({
    role: m.role,
    text: m.text
  }));

  let accumulatedText = '';

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: rawText,
        history: historyPayload,
        model: selectedModel,
        stream: true
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server error (${response.status})`);
    }

    // Process Server-Sent Events stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let hasReceivedFirstChunk = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop(); // Keep incomplete trailing chunk in buffer

      for (const part of parts) {
        const line = part.trim();
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));

            if (data.error) {
              throw new Error(data.error);
            }

            if (data.chunk) {
              if (!hasReceivedFirstChunk) {
                stopThinkingProcess();
                hasReceivedFirstChunk = true;
              }

              accumulatedText += data.chunk;
              // Stream word-by-word into DOM with cursor
              bubbleContent.innerHTML = `<div class="formatted-markdown">${renderMarkdown(accumulatedText)}<span class="streaming-cursor">▌</span></div>`;
              scrollToBottom(false);
            }

            if (data.done) {
              // Completed
            }
          } catch (jsonErr) {
            // Non-JSON line, continue
          }
        }
      }
    }

    stopThinkingProcess();

    // Finalize message rendering without blinking cursor
    bubbleContent.innerHTML = `<div class="formatted-markdown">${renderMarkdown(accumulatedText || 'No response generated.')}</div>`;
    attachCodeCopyHandlers(botRow);

    // Save bot message to state and localStorage
    const botMsg = {
      id: botMsgId,
      role: 'model',
      text: accumulatedText,
      timestamp: formatCurrentTime()
    };
    chatMessages.push(botMsg);
    saveChatHistory();

  } catch (err) {
    stopThinkingProcess();
    botRow.remove(); // Remove empty streaming row on failure
    console.error('Chat error:', err);
    renderErrorElement(err.message || 'Could not connect to FURYY server.');
  } finally {
    isGenerating = false;
    toggleSendButtonState();
    userInput.focus();
    scrollToBottom(true);
  }
}

function createStreamingBotRow(id) {
  const row = document.createElement('div');
  row.className = 'message-row bot-row';
  row.id = id;

  const botIconSvg = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>`;

  row.innerHTML = `
    <div class="message-avatar bot-avatar furyy-glow">
      ${botIconSvg}
    </div>
    <div class="message-wrapper">
      <div class="message-meta">
        <span class="sender-name">FURYY : THE AI</span>
        <span class="message-time">${formatCurrentTime()}</span>
      </div>
      <div class="message-bubble bubble-content">
        <span class="streaming-cursor">▌</span>
      </div>
    </div>
  `;
  return row;
}

function startThinkingProcess() {
  typingIndicator.style.display = 'flex';
  let stageIdx = 0;
  if (thinkingStageText) {
    thinkingStageText.textContent = THINKING_STAGES[0];
  }

  clearInterval(thinkingInterval);
  thinkingInterval = setInterval(() => {
    stageIdx = (stageIdx + 1) % THINKING_STAGES.length;
    if (thinkingStageText) {
      thinkingStageText.textContent = THINKING_STAGES[stageIdx];
    }
  }, 900);
}

function stopThinkingProcess() {
  clearInterval(thinkingInterval);
  typingIndicator.style.display = 'none';
}

function scrollToBottom(smooth = true) {
  setTimeout(() => {
    chatBody.scrollTo({
      top: chatBody.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }, 30);
}

function formatCurrentTime() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

// ==============================================================================
// 4. Message DOM Rendering & Markdown Parsing
// ==============================================================================
function renderMessageElement(msg, shouldAnimate = true) {
  const isUser = msg.role === 'user';
  const row = document.createElement('div');
  row.className = `message-row ${isUser ? 'user-row' : 'bot-row'}`;
  row.id = msg.id;

  if (!shouldAnimate) {
    row.style.animation = 'none';
  }

  const senderTitle = isUser ? 'You' : 'FURYY : THE AI';

  const botIconSvg = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>`;
  
  const userIconSvg = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>`;

  const avatarHtml = `
    <div class="message-avatar ${isUser ? 'user-avatar' : 'bot-avatar furyy-glow'}">
      ${isUser ? userIconSvg : botIconSvg}
    </div>`;

  let bodyHtml = '';
  if (isUser) {
    bodyHtml = `<div class="user-text">${escapeHtml(msg.text)}</div>`;
  } else {
    bodyHtml = `<div class="formatted-markdown">${renderMarkdown(msg.text)}</div>`;
  }

  row.innerHTML = `
    ${!isUser ? avatarHtml : ''}
    <div class="message-wrapper">
      <div class="message-meta">
        <span class="sender-name">${senderTitle}</span>
        <span class="message-time">${msg.timestamp || ''}</span>
      </div>
      <div class="message-bubble bubble-content">
        ${bodyHtml}
      </div>
    </div>
    ${isUser ? avatarHtml : ''}
  `;

  messagesList.appendChild(row);
  attachCodeCopyHandlers(row);
}

function renderErrorElement(errorText) {
  const row = document.createElement('div');
  row.className = 'message-row bot-row';

  const botIconSvg = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>`;

  row.innerHTML = `
    <div class="message-avatar bot-avatar" style="background: #ef4444;">
      ${botIconSvg}
    </div>
    <div class="message-wrapper">
      <div class="message-meta">
        <span class="sender-name">FURYY Notice</span>
        <span class="message-time">${formatCurrentTime()}</span>
      </div>
      <div class="message-bubble error-bubble">
        <div class="error-title">⚠️ Request Notice</div>
        <p>${escapeHtml(errorText)}</p>
      </div>
    </div>
  `;

  messagesList.appendChild(row);
  scrollToBottom(true);
}

// ==============================================================================
// 5. Safe Markdown Parser & Sanitizer
// ==============================================================================
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMarkdown(rawText) {
  if (!rawText) return '';

  const codeBlocks = [];
  let text = rawText.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push({
      lang: lang ? lang.trim() : 'code',
      code: code
    });
    return placeholder;
  });

  text = escapeHtml(text);
  text = text.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');
  text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  text = text.replace(/^>\s?(.*)$/gim, '<blockquote>$1</blockquote>');

  // Tables
  text = text.replace(/((?:\|[^\n]+\|\n?){2,})/g, (tableMatch) => {
    const rows = tableMatch.trim().split('\n').filter(r => r.trim().startsWith('|'));
    if (rows.length < 2) return tableMatch;

    const isHeaderRow = /^[|\s-:]+$/.test(rows[1]);
    let tableHtml = '<div class="table-wrapper"><table class="formatted-table">';

    rows.forEach((rowStr, idx) => {
      if (idx === 1 && isHeaderRow) return;
      const cells = rowStr.split('|').slice(1, -1).map(c => c.trim());
      tableHtml += '<tr>';
      cells.forEach(cell => {
        if (idx === 0 && isHeaderRow) {
          tableHtml += `<th>${cell}</th>`;
        } else {
          tableHtml += `<td>${cell}</td>`;
        }
      });
      tableHtml += '</tr>';
    });

    tableHtml += '</table></div>';
    return tableHtml;
  });

  // Ordered and Unordered Lists
  const lines = text.split('\n');
  let inUl = false;
  let inOl = false;
  let resultLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ulMatch = line.match(/^(\s*)[-*]\s+(.+)/);
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)/);

    if (ulMatch) {
      if (!inUl) {
        if (inOl) { resultLines.push('</ol>'); inOl = false; }
        resultLines.push('<ul>');
        inUl = true;
      }
      resultLines.push(`<li>${ulMatch[2]}</li>`);
    } else if (olMatch) {
      if (!inOl) {
        if (inUl) { resultLines.push('</ul>'); inUl = false; }
        resultLines.push('<ol>');
        inOl = true;
      }
      resultLines.push(`<li>${olMatch[2]}</li>`);
    } else {
      if (inUl) { resultLines.push('</ul>'); inUl = false; }
      if (inOl) { resultLines.push('</ol>'); inOl = false; }
      resultLines.push(line);
    }
  }

  if (inUl) resultLines.push('</ul>');
  if (inOl) resultLines.push('</ol>');

  text = resultLines.join('\n');

  // Paragraphs
  const paragraphs = text.split(/\n\s*\n/);
  text = paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (/^(<h[1-3]|<ul|<ol|<blockquote|<div)/.test(trimmed)) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .join('');

  // Reinsert Code Blocks with Copy button
  codeBlocks.forEach((block, index) => {
    const placeholder = `__CODE_BLOCK_${index}__`;
    const safeCode = escapeHtml(block.code.trim());
    const displayLang = block.lang || 'code';

    const copyIconSvg = `
      <svg class="copy-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>`;

    const blockHtml = `
      <div class="code-block-container">
        <div class="code-block-header">
          <span class="code-language">${displayLang}</span>
          <button class="copy-code-btn" type="button" aria-label="Copy code block">
            ${copyIconSvg}
            <span class="copy-text">Copy</span>
          </button>
        </div>
        <pre class="code-block-pre"><code class="language-${displayLang}">${safeCode}</code></pre>
      </div>
    `;

    text = text.replace(placeholder, blockHtml);
  });

  return text;
}

function attachCodeCopyHandlers(scopeElement) {
  const copyButtons = scopeElement.querySelectorAll('.copy-code-btn');
  copyButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const pre = btn.closest('.code-block-container').querySelector('pre code');
      if (!pre) return;

      const codeToCopy = pre.innerText;

      try {
        await navigator.clipboard.writeText(codeToCopy);
        btn.classList.add('copied');
        const textSpan = btn.querySelector('.copy-text');
        const originalText = textSpan.textContent;
        textSpan.textContent = 'Copied!';

        setTimeout(() => {
          btn.classList.remove('copied');
          textSpan.textContent = originalText;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy code to clipboard', err);
        showToast('Failed to copy to clipboard', 'error');
      }
    });
  });
}

// ==============================================================================
// 6. Toast Notification Utility
// ==============================================================================
function showToast(message, type = 'info') {
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
