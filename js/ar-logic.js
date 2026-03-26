// NOME DO ARQUIVO: ar-logic.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { askGemini, adicionarAoHistorico } from './gemini-api.js';
import { database, ref, get } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const chatDisplay = document.getElementById('chat-display');
    const userInput = document.getElementById('user-input');
    const btnSend = document.getElementById('btn-send');
    const btnMic = document.getElementById('btn-mic');
    const videoMascote = document.getElementById('vid');
    
    const startScreen = document.getElementById('start-screen');
    const uiLayer = document.getElementById('ui-layer');

    let isProcessing = false;
    let audioAtual = null;

    document.getElementById('btn-start').addEventListener('click', () => {
        startScreen.classList.add('hidden');
        uiLayer.classList.remove('hidden');
        
        if(videoMascote) {
            videoMascote.play().catch(e => console.log("Vídeo auto-play bloqueado."));
        }

        if(chatDisplay.children.length === 0) {
            const msgInicial = "Olá! Sou o arquiteto inteligente da thIAguinho Soluções! Como posso te chamar? E você busca uma solução para sua Empresa ou para sua Vida Pessoal? [OPCOES: Para minha Empresa | Para minha Vida Pessoal]";
            processarEExibirMensagemBot(msgInicial);
        }
    });

    // --- SÍNTESE DE VOZ 100% GEMINI TTS (Qualidade de Estúdio 24kHz) ---
    async function falar(texto) {
        if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
        if (audioAtual) { audioAtual.pause(); audioAtual = null; }

        let textoVoz = texto.replace(/\[OPCOES:.*?\]/i, '').replace(/\*\*/g, '');
        if(!textoVoz.trim()) return;

        try {
            // Busca as chaves do Gemini que você configurou no painel Admin
            const snapKey = await get(ref(database, 'admin_config/gemini_api_key'));
            const snapVoice = await get(ref(database, 'admin_config/gemini_voice_name'));
            
            if (snapKey.exists()) {
                const apiKey = snapKey.val();
                const voiceName = snapVoice.exists() ? snapVoice.val() : "Aoede";
                
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
                const payload = {
                    contents: [{ parts: [{ text: textoVoz }] }],
                    generationConfig: {
                        responseModalities: ["AUDIO"],
                        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } }
                    }
                };

                const res = await fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
                const data = await res.json();
                
                if (data.candidates && data.candidates[0].content.parts[0].inlineData) {
                    const base64Audio = data.candidates[0].content.parts[0].inlineData.data;
                    const binaryString = window.atob(base64Audio);
                    const buffer = new ArrayBuffer(binaryString.length);
                    const view = new Uint8Array(buffer);
                    for (let i = 0; i < binaryString.length; i++) {
                        view[i] = binaryString.charCodeAt(i);
                    }
                    
                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const int16View = new Int16Array(buffer);
                    const audioBuffer = audioCtx.createBuffer(1, int16View.length, 24000); // 24kHz do Gemini
                    const channelData = audioBuffer.getChannelData(0);
                    for (let i = 0; i < int16View.length; i++) {
                        channelData[i] = int16View[i] / 32768.0;
                    }
                    
                    const source = audioCtx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(audioCtx.destination);
                    source.start();
                    return; // Sucesso com a Voz do Gemini!
                }
            }
        } catch (error) {
            console.warn("Falha no Motor Gemini, ativando plano B local: ", error);
        }

        // Fallback: Voz nativa se der erro de internet
        const utterance = new SpeechSynthesisUtterance(textoVoz);
        utterance.lang = 'pt-BR';
        window.speechSynthesis.speak(utterance);
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        btnMic.addEventListener('click', () => {
            if (isProcessing) return; 
            if (btnMic.classList.contains('listening')) { 
                recognition.stop(); 
                btnMic.classList.remove('listening'); 
                userInput.placeholder = "Digite ou escolha uma opção..."; 
            } else { 
                recognition.start(); 
                btnMic.classList.add('listening'); 
                userInput.placeholder = "Ouvindo..."; 
            }
        });
        recognition.onresult = (e) => {
            userInput.value = e.results[0][0].transcript;
            btnMic.classList.remove('listening');
            userInput.placeholder = "Digite ou escolha uma opção..."; 
            enviarMensagemDigitada(); 
        };
    } else {
        btnMic.style.display = 'none'; 
    }

    function addMsgVisual(sender, text) {
        const div = document.createElement('div');
        div.className = `msg ${sender}`;
        div.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        chatDisplay.appendChild(div);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    }

    function processarEExibirMensagemBot(respostaCompleta) {
        const regexOpcoes = /\[OPCOES:\s*(.*?)\]/i;
        const match = respostaCompleta.match(regexOpcoes);
        
        let textoLimpo = respostaCompleta.replace(regexOpcoes, '').trim();
        
        addMsgVisual('bot', textoLimpo);
        adicionarAoHistorico('bot', respostaCompleta); 
        falar(textoLimpo);

        if (match && match[1]) {
            const opcoes = match[1].split('|').map(o => o.trim());
            renderizarBotoesDeOpcao(opcoes);
        }
    }

    function renderizarBotoesDeOpcao(arrayOpcoes) {
        const antigos = document.getElementById('opcoes-ativas');
        if(antigos) antigos.remove();

        const container = document.createElement('div');
        container.className = 'opcoes-container';
        container.id = 'opcoes-ativas';

        arrayOpcoes.forEach(opcaoText => {
            const btn = document.createElement('button');
            btn.className = 'btn-opcao';
            btn.innerText = opcaoText;
            btn.onclick = (event) => {
                if(isProcessing) { event.preventDefault(); return; }
                isProcessing = true; 
                container.style.opacity = '0.5';
                container.style.pointerEvents = 'none'; 
                setTimeout(() => { enviarMensagemClicada(opcaoText); }, 50); 
            };
            container.appendChild(btn);
        });

        chatDisplay.appendChild(container);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    }

    async function enviarMensagemClicada(textoClicado) {
        const antigasOpcoes = document.getElementById('opcoes-ativas');
        if(antigasOpcoes) antigasOpcoes.remove(); 
        addMsgVisual('user', textoClicado);
        adicionarAoHistorico('user', textoClicado);
        await invocarGemini(textoClicado);
    }

    async function enviarMensagemDigitada() {
        if(isProcessing) return;
        const msg = userInput.value.trim();
        if (!msg) return;
        isProcessing = true;
        
        userInput.value = '';
        const antigasOpcoes = document.getElementById('opcoes-ativas');
        if(antigasOpcoes) antigasOpcoes.remove(); 

        addMsgVisual('user', msg);
        adicionarAoHistorico('user', msg);
        await invocarGemini(msg);
    }

    async function invocarGemini(textoUser) {
        btnSend.style.opacity = '0.5';
        btnSend.style.pointerEvents = 'none';
        userInput.disabled = true;

        const ind = document.createElement('div');
        ind.className = "text-xs text-slate-400 mt-1 mb-3 text-center font-bold";
        ind.id = "digitando"; 
        ind.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Construindo a arquitetura técnica...";
        chatDisplay.appendChild(ind);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;

        const resp = await askGemini(textoUser);

        document.getElementById('digitando')?.remove();
        processarEExibirMensagemBot(resp); 

        isProcessing = false;
        btnSend.style.opacity = '1';
        btnSend.style.pointerEvents = 'auto';
        userInput.disabled = false;
        userInput.focus();
    }

    btnSend.addEventListener('click', enviarMensagemDigitada);
    userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') enviarMensagemDigitada(); });
});