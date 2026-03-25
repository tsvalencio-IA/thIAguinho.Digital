// NOME DO ARQUIVO: ar-logic.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { askGemini, adicionarAoHistorico } from './gemini-api.js';

document.addEventListener('DOMContentLoaded', () => {
    const chatDisplay = document.getElementById('chat-display');
    const userInput = document.getElementById('user-input');
    const btnSend = document.getElementById('btn-send');
    const btnMic = document.getElementById('btn-mic');
    
    const alvoAR = document.getElementById('alvo-ar');
    const videoMascote = document.getElementById('vid');

    // TRAVA ANTI-SPAM E DUPLO CLIQUE BLINDADA
    let isProcessing = false;

    if(alvoAR && videoMascote) {
        alvoAR.addEventListener("targetFound", () => {
            videoMascote.play();
            if(chatDisplay.children.length === 0) {
                const msgInicial = "Olá! Sou o arquiteto inteligente da thIAguinho Soluções! Como posso te chamar? E você busca uma solução para sua Empresa ou para sua Vida Pessoal/Rotina? [OPCOES: Para minha Empresa | Para minha Rotina Pessoal]";
                processarEExibirMensagemBot(msgInicial);
            }
        });
        alvoAR.addEventListener("targetLost", () => videoMascote.pause());
    }

    const synthesis = window.speechSynthesis;
    function falar(texto) {
        if (synthesis.speaking) synthesis.cancel();
        let textoVoz = texto.replace(/\[OPCOES:.*?\]/i, '').replace(/\*\*/g, '');
        const utterance = new SpeechSynthesisUtterance(textoVoz);
        utterance.lang = 'pt-BR';
        synthesis.speak(utterance);
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
                userInput.placeholder = "Digite ou fale com o mascote..."; 
            } else { 
                recognition.start(); 
                btnMic.classList.add('listening'); 
                userInput.placeholder = "Ouvindo..."; 
            }
        });
        recognition.onresult = (e) => {
            userInput.value = e.results[0][0].transcript;
            btnMic.classList.remove('listening');
            userInput.placeholder = "Digite ou fale com o mascote..."; 
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
                // TRAVA ABSOLUTA: Se já clicou, ignora totalmente
                if(isProcessing) {
                    event.preventDefault();
                    return;
                }
                isProcessing = true; 
                
                // Desativa os cliques visuais e lógicos na hora
                container.style.opacity = '0.5';
                container.style.pointerEvents = 'none'; 
                
                // Remove os botões da tela e manda a mensagem
                setTimeout(() => {
                    enviarMensagemClicada(opcaoText);
                }, 50); // Delay mínimo para garantir a trava de estado
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

        // DESLIGA A TRAVA GLOBAL DE SEGURANÇA
        isProcessing = false;
        btnSend.style.opacity = '1';
        btnSend.style.pointerEvents = 'auto';
        userInput.disabled = false;
        userInput.focus();
    }

    btnSend.addEventListener('click', enviarMensagemDigitada);
    userInput.addEventListener('keypress', (e) => { 
        if (e.key === 'Enter') enviarMensagemDigitada(); 
    });
});
