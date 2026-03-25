import { askGemini, adicionarAoHistorico } from './gemini-api.js';

document.addEventListener('DOMContentLoaded', () => {
    const chatDisplay = document.getElementById('chat-display');
    const userInput = document.getElementById('user-input');
    const btnSend = document.getElementById('btn-send');
    const btnMic = document.getElementById('btn-mic');
    
    const alvoAR = document.getElementById('alvo-ar');
    const videoMascote = document.getElementById('vid');

    if(alvoAR && videoMascote) {
        alvoAR.addEventListener("targetFound", () => {
            videoMascote.play();
            if(chatDisplay.children.length === 0) {
                const msg = "Olá! Sou o arquiteto de sistemas e mascote da thIAguinho Soluções! Qual é o seu nome e de qual empresa você fala?";
                addMsg('bot', msg);
                adicionarAoHistorico('bot', msg);
                falar(msg);
            }
        });
        alvoAR.addEventListener("targetLost", () => videoMascote.pause());
    }

    const synthesis = window.speechSynthesis;
    function falar(texto) {
        if (synthesis.speaking) synthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(texto.replace(/\*\*/g, ''));
        utterance.lang = 'pt-BR';
        synthesis.speak(utterance);
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        btnMic.addEventListener('click', () => {
            if (btnMic.classList.contains('listening')) { 
                recognition.stop(); 
                btnMic.classList.remove('listening'); 
            } else { 
                recognition.start(); 
                btnMic.classList.add('listening'); 
                userInput.placeholder = "Ouvindo sua dor..."; 
            }
        });
        recognition.onresult = (e) => {
            userInput.value = e.results[0][0].transcript;
            btnMic.classList.remove('listening');
            enviarMensagem(); 
        };
    } else {
        btnMic.style.display = 'none'; 
    }

    function addMsg(sender, text) {
        const div = document.createElement('div');
        div.className = `msg ${sender}`;
        div.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        chatDisplay.appendChild(div);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    }

    async function enviarMensagem() {
        const msg = userInput.value.trim();
        if (!msg) return;
        
        userInput.value = '';
        addMsg('user', msg);
        adicionarAoHistorico('user', msg);

        const ind = document.createElement('div');
        ind.className = "text-xs text-slate-400 mt-1 mb-3 text-center font-bold";
        ind.id = "digitando"; 
        ind.innerText = "Desenhando o Facilitóide...";
        chatDisplay.appendChild(ind);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;

        const resp = await askGemini(msg);

        document.getElementById('digitando')?.remove();
        addMsg('bot', resp);
        adicionarAoHistorico('bot', resp);
        falar(resp);
    }

    btnSend.addEventListener('click', enviarMensagem);
    userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') enviarMensagem(); });
});
