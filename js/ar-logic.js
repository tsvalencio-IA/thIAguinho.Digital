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
                // Inicia com botões de exemplo para o cliente não precisar digitar
                const msgInicial = "Olá! Sou o arquiteto de sistemas da thIAguinho Soluções! Qual é o setor da sua empresa? [OPCOES: Comércio e Lojas | Prestação de Serviços | Indústria | Outros]";
                processarEExibirMensagemBot(msgInicial);
            }
        });
        alvoAR.addEventListener("targetLost", () => videoMascote.pause());
    }

    const synthesis = window.speechSynthesis;
    function falar(texto) {
        if (synthesis.speaking) synthesis.cancel();
        // Remove as tags de opção para o robô não as ler em voz alta
        let textoVoz = texto.replace(/\[OPCOES:.*?\]/i, '').replace(/\*\*/g, '');
        const utterance = new SpeechSynthesisUtterance(textoVoz);
        utterance.lang = 'pt-BR';
        synthesis.speak(utterance);
    }

    // Lógica do Microfone
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
                userInput.placeholder = "A escutar..."; 
            }
        });
        recognition.onresult = (e) => {
            userInput.value = e.results[0][0].transcript;
            btnMic.classList.remove('listening');
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

    // --- LÓGICA PRINCIPAL: PROCESSA OS BOTÕES DO GEMINI ---
    function processarEExibirMensagemBot(respostaCompleta) {
        // Interceta a tag [OPCOES: a | b | c]
        const regexOpcoes = /\[OPCOES:\s*(.*?)\]/i;
        const match = respostaCompleta.match(regexOpcoes);
        
        // Remove a tag do texto principal que vai para o balão de chat
        let textoLimpo = respostaCompleta.replace(regexOpcoes, '').trim();
        
        // Adiciona a mensagem normal do robô
        addMsgVisual('bot', textoLimpo);
        adicionarAoHistorico('bot', respostaCompleta); 
        falar(textoLimpo);

        // Se houver opções, cria os botões no ecrã
        if (match && match[1]) {
            const opcoes = match[1].split('|').map(o => o.trim());
            renderizarBotoesDeOpcao(opcoes);
        }
    }

    // --- RENDERIZA OS BOTÕES CLICÁVEIS ---
    function renderizarBotoesDeOpcao(arrayOpcoes) {
        // Remove botões antigos se houver
        const antigos = document.getElementById('opcoes-ativas');
        if(antigos) antigos.remove();

        const container = document.createElement('div');
        container.className = 'opcoes-container';
        container.id = 'opcoes-ativas';

        arrayOpcoes.forEach(opcaoText => {
            const btn = document.createElement('button');
            btn.className = 'btn-opcao';
            btn.innerText = opcaoText;
            btn.onclick = () => {
                container.remove(); // Desaparece com as opções após o clique
                enviarMensagemClicada(opcaoText);
            };
            container.appendChild(btn);
        });

        chatDisplay.appendChild(container);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    }

    // Disparado quando o utilizador CLICA num botão de opção
    async function enviarMensagemClicada(textoClicado) {
        addMsgVisual('user', textoClicado);
        adicionarAoHistorico('user', textoClicado);
        invocarGemini(textoClicado);
    }

    // Disparado quando o utilizador DIGITA ou FALA no microfone
    async function enviarMensagemDigitada() {
        const msg = userInput.value.trim();
        if (!msg) return;
        
        userInput.value = '';
        
        // Remove opções visuais, pois ele preferiu digitar
        const antigasOpcoes = document.getElementById('opcoes-ativas');
        if(antigasOpcoes) antigasOpcoes.remove();

        addMsgVisual('user', msg);
        adicionarAoHistorico('user', msg);
        invocarGemini(msg);
    }

    // Processamento Central da IA
    async function invocarGemini(textoUser) {
        const ind = document.createElement('div');
        ind.className = "text-xs text-slate-400 mt-1 mb-3 text-center font-bold";
        ind.id = "digitando"; 
        ind.innerText = "A desenhar o Facilitóide...";
        chatDisplay.appendChild(ind);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;

        const resp = await askGemini(textoUser);

        document.getElementById('digitando')?.remove();
        processarEExibirMensagemBot(resp); // Processa e verifica se tem botões novos
    }

    btnSend.addEventListener('click', enviarMensagemDigitada);
    userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') enviarMensagemDigitada(); });
});
