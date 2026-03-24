// NOME DO FICHEIRO: ar-logic.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

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
            // A IA inicia a conversa de forma inteligente
            if(chatDisplay.children.length === 0) {
                const msg = "Olá! Eu sou o mascote e Arquiteto de Software da thIAguinho Soluções Digitais! Qual é o seu nome e de qual empresa fala?";
                adicionarMensagemUI('bot', msg);
                adicionarAoHistorico('bot', msg);
                falarTexto(msg);
            }
        });
        
        alvoAR.addEventListener("targetLost", () => videoMascote.pause());
    }

    // Funcionalidade de Fala do Mascote
    const synthesis = window.speechSynthesis;
    function falarTexto(texto) {
        if (synthesis.speaking) synthesis.cancel();
        let textoLimpo = texto.replace(/\*\*/g, ''); 
        const utterance = new SpeechSynthesisUtterance(textoLimpo);
        utterance.lang = 'pt-BR';
        synthesis.speak(utterance);
    }

    // Funcionalidade de Escuta (Microfone)
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
                userInput.placeholder = "A ouvir as suas necessidades..."; 
            }
        });
        recognition.onresult = (e) => {
            userInput.value = e.results[0][0].transcript;
            btnMic.classList.remove('listening');
            userInput.placeholder = "Fale com o arquiteto...";
            enviarMensagem(); 
        };
    } else {
        btnMic.style.display = 'none'; 
    }

    function adicionarMensagemUI(sender, text) {
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
        adicionarMensagemUI('user', msg);
        adicionarAoHistorico('user', msg);

        const ind = document.createElement('div');
        ind.className = "text-xs text-slate-400 mt-1 mb-3 text-center";
        ind.id = "digitando"; 
        ind.innerText = "Mascote a desenhar o Facilitóide...";
        chatDisplay.appendChild(ind);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;

        const respostaBot = await askGemini(msg);

        document.getElementById('digitando')?.remove();
        adicionarMensagemUI('bot', respostaBot);
        adicionarAoHistorico('bot', respostaBot);
        falarTexto(respostaBot);
    }

    btnSend.addEventListener('click', enviarMensagem);
    userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') enviarMensagem(); });
});