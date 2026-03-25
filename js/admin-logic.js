// NOME DO ARQUIVO: admin-logic.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { auth, database, signInWithEmailAndPassword, signOut, onAuthStateChanged, ref, set, onValue, get } from './firebase-config.js';
import { atualizarPromptMemoria, systemPrompt as promptPadraoDaAPI, conversarComDesenvolvedorIA } from './gemini-api.js';

document.addEventListener('DOMContentLoaded', () => {
    
    const emailInput = document.getElementById('email-admin');
    const senhaInput = document.getElementById('senha-admin');
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const erroMsg = document.getElementById('msg-erro-login');
    
    const apiKeyInput = document.getElementById('api-key-input');
    const gridLeads = document.getElementById('grid-leads');
    const modalProjeto = document.getElementById('modal-projeto');
    
    let usuarioLogado = null;
    let listaDeClientesGlobais = [];
    
    // Variáveis cruciais para a Fábrica lembrar do projeto
    let contextoProjetoAtual = ""; 
    let idProjetoAberto = null;
    let historicoDevAtual = [];

    // --- SESSÃO E LOGIN ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            usuarioLogado = user;
            if(erroMsg) erroMsg.classList.add('oculto');
            document.getElementById('admin-login').classList.add('oculto');
            document.getElementById('admin-dashboard').classList.remove('oculto');
            iniciarLeituraDoBancoDeDados();
        } else {
            usuarioLogado = null;
            document.getElementById('admin-dashboard').classList.add('oculto');
            document.getElementById('admin-login').classList.remove('oculto');
        }
    });

    if(btnLogin) {
        btnLogin.addEventListener('click', () => {
            btnLogin.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Conectando...";
            signInWithEmailAndPassword(auth, emailInput.value, senhaInput.value)
                .catch((error) => { erroMsg.classList.remove('oculto'); btnLogin.innerHTML = "Entrar no Painel"; });
        });
    }

    if(btnLogout) {
        btnLogout.addEventListener('click', () => signOut(auth).then(() => window.location.reload()));
    }

    if(document.getElementById('btn-save-key')) {
        document.getElementById('btn-save-key').addEventListener('click', () => {
            if (!usuarioLogado) return;
            const novaChave = apiKeyInput.value.trim();
            if(!novaChave) return;
            const btn = document.getElementById('btn-save-key');
            btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i>";
            set(ref(database, 'admin_config/gemini_api_key'), novaChave)
                .then(() => { btn.innerHTML = "Guardada"; setTimeout(() => btn.innerHTML = "Guardar", 2000); });
        });
    }

    if(document.getElementById('btn-save-prompt')) {
        document.getElementById('btn-save-prompt').addEventListener('click', () => {
            if (!usuarioLogado) return;
            const btn = document.getElementById('btn-save-prompt');
            btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i>...";
            const novoPrompt = document.getElementById('prompt-ia').value;
            set(ref(database, 'admin_config/prompt_mascote'), novoPrompt)
                .then(() => { atualizarPromptMemoria(novoPrompt); btn.innerHTML = "Atualizado!"; setTimeout(() => btn.innerHTML = "Atualizar Cérebro", 2000); });
        });
    }

    // --- LEITURA DA BASE DE DADOS CRM ---
    function iniciarLeituraDoBancoDeDados() {
        get(ref(database, 'admin_config/gemini_api_key')).then((snapshot) => {
            if(snapshot.exists() && apiKeyInput) apiKeyInput.value = snapshot.val();
        });

        get(ref(database, 'admin_config/prompt_mascote')).then((snapshot) => {
            const caixaTexto = document.getElementById('prompt-ia');
            if (snapshot.exists() && caixaTexto) {
                caixaTexto.value = snapshot.val();
                atualizarPromptMemoria(snapshot.val());
            } else if(caixaTexto) {
                caixaTexto.value = promptPadraoDaAPI;
            }
        });

        onValue(ref(database, 'projetos_capturados'), (snapshot) => {
            if(!gridLeads) return;
            gridLeads.innerHTML = ''; 
            if (!snapshot.exists()) {
                gridLeads.innerHTML = '<div class="col-span-full text-center py-10 text-slate-500"><p>Nenhum projeto desenhado ainda.</p></div>';
                return;
            }

            listaDeClientesGlobais = [];
            snapshot.forEach((filho) => listaDeClientesGlobais.push({ id: filho.key, ...filho.val() }));
            listaDeClientesGlobais.sort((a, b) => new Date(b.data) - new Date(a.data));

            listaDeClientesGlobais.forEach((cliente, index) => {
                const dataFormatada = new Date(cliente.data).toLocaleDateString('pt-BR');
                let numWpp = cliente.whatsapp ? cliente.whatsapp.replace(/\D/g, '') : '';
                if (numWpp.length >= 10 && numWpp.length <= 11) numWpp = '55' + numWpp; 
                else if (!numWpp.startsWith('55') && numWpp.length >= 12) numWpp = '55' + numWpp; 
                
                const card = document.createElement('div');
                card.className = "bg-slate-900 border border-slate-700 rounded-xl p-5 hover:border-sky-500 transition shadow-lg flex flex-col justify-between cursor-pointer group";
                card.onclick = (e) => { if(!e.target.closest('a') && !e.target.closest('button.btn-trash')) window.abrirModalProjeto(index); };
                card.innerHTML = `
                    <div>
                        <div class="flex justify-between items-start mb-3">
                            <div><h4 class="font-bold text-white text-lg">${cliente.nome}</h4><p class="text-xs text-sky-400 font-semibold uppercase">${cliente.empresa}</p></div>
                            <span class="text-[10px] text-slate-500 bg-slate-800 px-2 py-1 rounded">${dataFormatada}</span>
                        </div>
                        <p class="text-sm text-slate-300 line-clamp-2 mb-4 italic">"${cliente.dores}"</p>
                    </div>
                    <div class="border-t border-slate-700 pt-4 mt-auto flex gap-2">
                        <button class="flex-1 bg-sky-900/40 group-hover:bg-sky-600 text-white text-sm font-semibold py-2 rounded-lg transition border border-sky-800 flex items-center justify-center gap-2"><i class='bx bx-terminal'></i> Abrir Fábrica</button>
                        <a href="https://wa.me/${numWpp}?text=Olá ${cliente.nome}, sou o Thiago..." target="_blank" class="w-10 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center"><i class='bx bxl-whatsapp text-lg'></i></a>
                        <button onclick="window.excluirProjeto('${cliente.id}')" class="btn-trash w-10 bg-slate-800 hover:bg-red-700 text-slate-400 hover:text-white rounded-lg flex items-center justify-center"><i class='bx bx-trash text-lg'></i></button>
                    </div>
                `;
                gridLeads.appendChild(card);
            });
        });
    }

    window.excluirProjeto = function(idProjeto) {
        if (confirm("Deseja excluir este projeto da fábrica?")) set(ref(database, `projetos_capturados/${idProjeto}`), null);
    };

    // --- O ESTÚDIO DO ARQUITETO (MODAL + CHAT DEV PERSISTENTE) ---
    window.abrirModalProjeto = function(index) {
        const c = listaDeClientesGlobais[index];
        if(!c) return;

        // Guarda os dados para usar no chat
        idProjetoAberto = c.id;
        historicoDevAtual = c.devChat || []; // Carrega o histórico salvo no Firebase!

        document.getElementById('modal-nome').innerText = c.nome;
        document.getElementById('modal-empresa').innerText = c.empresa;
        document.getElementById('modal-dores').innerText = c.dores;
        
        let formataFacilitoide = c.facilitoide ? c.facilitoide.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong class="text-emerald-400">$1</strong>') : "Sem arquitetura.";
        document.getElementById('modal-facilitoide').innerHTML = formataFacilitoide;
        
        contextoProjetoAtual = `Cliente: ${c.nome}. Empresa: ${c.empresa}. Dor: ${c.dores}. A ideia do sistema a construir é: ${c.facilitoide}`;
        
        const chatDisplay = document.getElementById('dev-chat-display');
        chatDisplay.innerHTML = `<div class="msg-dev ai">Olá, Thiago! Sou a sua IA Desenvolvedora. Analisei a arquitetura deste projeto. Pode pedir os códigos e regras que precisa!</div>`;

        // Imprime na tela todo o histórico que veio salvo do Firebase
        historicoDevAtual.forEach(msg => {
            const div = document.createElement('div');
            div.className = `msg-dev ${msg.role === 'user' ? 'admin' : 'ai shadow-lg'}`;
            div.innerHTML = msg.role === 'user' ? msg.text : formatarCodigoIA(msg.text);
            chatDisplay.appendChild(div);
        });

        chatDisplay.scrollTop = chatDisplay.scrollHeight;

        let numModal = c.whatsapp ? c.whatsapp.replace(/\D/g, '') : '';
        if (numModal.length >= 10 && numModal.length <= 11) numModal = '55' + numModal;
        document.getElementById('modal-whatsapp').href = `https://wa.me/${numModal}`;

        if(modalProjeto) modalProjeto.classList.remove('oculto');
    };

    document.getElementById('btn-fechar-modal').addEventListener('click', () => modalProjeto.classList.add('oculto'));

    // --- LÓGICA DO CHAT DE PROGRAMAÇÃO (SALVANDO NO FIREBASE) ---
    const devInput = document.getElementById('dev-input');
    const btnDevSend = document.getElementById('btn-dev-send');
    const chatDisplay = document.getElementById('dev-chat-display');

    function formatarCodigoIA(texto) {
        return texto.replace(/```(.*?)\n([\s\S]*?)```/g, '<pre><code class="$1">$2</code></pre>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    }

    async function enviarMsgDev() {
        const msg = devInput.value.trim();
        if(!msg || !idProjetoAberto) return;

        devInput.value = '';
        devInput.disabled = true;
        btnDevSend.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i>";

        const divAdmin = document.createElement('div');
        divAdmin.className = "msg-dev admin";
        divAdmin.innerText = msg;
        chatDisplay.appendChild(divAdmin);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;

        // Chama a IA e passa o histórico que estava salvo
        const respostaDaIA = await conversarComDesenvolvedorIA(msg, contextoProjetoAtual, historicoDevAtual);

        const divAI = document.createElement('div');
        divAI.className = "msg-dev ai shadow-lg";
        divAI.innerHTML = formatarCodigoIA(respostaDaIA);
        chatDisplay.appendChild(divAI);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;

        // Atualiza a memória local
        historicoDevAtual.push({ role: 'user', text: msg });
        historicoDevAtual.push({ role: 'model', text: respostaDaIA });

        // SALVA TUDO NO FIREBASE (Atrelado ao ID do cliente)
        set(ref(database, `projetos_capturados/${idProjetoAberto}/devChat`), historicoDevAtual);

        devInput.disabled = false;
        devInput.focus();
        btnDevSend.innerHTML = "<i class='bx bx-send'></i>";
    }

    if(btnDevSend) btnDevSend.addEventListener('click', enviarMsgDev);
    if(devInput) devInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') enviarMsgDev(); });
});