import { askGemini, chatHistory } from './gemini-api.js';

const chatDisplay = document.getElementById('chat-history');
const chatInput = document.getElementById('chat-input');
const btnSend = document.getElementById('btn-send-chat');

export function appendMessage(role, text) {
    const div = document.createElement('div');
    const isBot = role === 'bot';
    div.className = `p-3 rounded-xl max-w-[85%] text-sm shadow-md ${isBot ? 'bg-slate-800 border border-slate-700 text-white self-start' : 'bg-red-600 text-white self-end ml-auto'}`;
    const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-red-400">$1</strong>');
    div.innerHTML = formattedText;
    chatDisplay.appendChild(div);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

async function handleSendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    chatInput.value = '';
    appendMessage('user', text);
    chatHistory.push({ role: 'user', text: text });

    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'text-xs text-slate-500 italic mt-1';
    typingIndicator.id = 'typing-indicator';
    typingIndicator.innerText = 'thIAguinho está pensando...';
    chatDisplay.appendChild(typingIndicator);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;

    const reply = await askGemini(text);
    
    document.getElementById('typing-indicator')?.remove();
    appendMessage('bot', reply);
    chatHistory.push({ role: 'bot', text: reply });
}

export function initChatEvents() {
    btnSend.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });
}
