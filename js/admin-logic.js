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
    
    // Controles de Estado do CRM
    let usuarioLogado = null;
    let listaDeClientesGlobais = [];
    let abaAtiva = 'novos'; // Pode ser 'novos' ou 'concluidos'
    
    let contextoProjetoAtual = ""; 
    let idProjetoAberto = null;
    let historicoDevAtual = [];

    // --- CONTROLE DAS ABAS ---
    const tabNovos = document.getElementById('tab-novos');
    const tabConcluidos = document.getElementById('tab-concluidos');

    tabNovos.addEventListener('click', () => {
        abaAtiva = 'novos';
        tabNovos.classList.replace('text-slate-400', 'text-white');
        tabNovos.classList.add('border-b-2', 'border-red-500');
        tabConcluidos.classList.replace('text-white', 'text-slate-400');
        tabConcluidos.classList.remove('border-b-2', 'border-red-500');
        renderizarProjetos();
    });

    tabConcluidos.addEventListener('click', () => {
        abaAtiva = 'concluidos';
        tabConcluidos.classList.replace('text-slate-400', 'text-white');
        tabConcluidos.classList.add('border-b-2', 'border-red-500');
        tabNovos.classList.replace('text-white', 'text-slate-400');
        tabNovos.classList.remove('border-b-2', 'border-red-500');
        renderizarProjetos();
    });

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

    // Configurações do Firebase
    if(document.getElementById('btn-save-key')) {
        document.getElementById('btn-save-key').addEventListener('click', () => {
            if (!usuarioLogado) return;
            const novaChave = apiKeyInput.value.trim();
            if(!novaChave) return;
            const btn = document.getElementById('btn-save-key');
            btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i>";
            set(ref(database, 'admin_config/gemini_api_key'), novaChave)
                .then(() => { btn.innerHTML = "Salva"; setTimeout(() => btn.innerHTML = "Salvar", 2000); });
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

    // --- LEITURA DA BASE DE DADOS ---
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
            listaDeClientesGlobais = [];
            if (snapshot.exists()) {
                snapshot.forEach((filho) => listaDeClientesGlobais.push({ id: filho.key, ...filho.val() }));
                // Ordena do mais novo para o mais velho
                listaDeClientesGlobais.sort((a, b) => new Date(b.data) - new Date(a.data));
            }
            renderizarProjetos();
        });
    }

    // --- RENDERIZAÇÃO INTELIGENTE (MINIMIZAR/MAXIMIZAR E ABAS) ---
    function renderizarProjetos() {
        if(!gridLeads) return;
        gridLeads.innerHTML = ''; 
        
        // Filtra pela aba ativa
        const projetosFiltrados = listaDeClientesGlobais.filter(cliente => {
            const status = cliente.status || 'novo'; // Se não tiver status no banco, é novo
            return abaAtiva === 'novos' ? status === 'novo' : status === 'concluido';
        });

        if (projetosFiltrados.length === 0) {
            gridLeads.innerHTML = `<div class="text-center py-10 text-slate-500"><i class='bx bx-sleepy text-4xl mb-3'></i><p>Nenhum projeto nesta aba.</p></div>`;
            return;
        }

        projetosFiltrados.forEach(cliente => {
            const dataFormatada = new Date(cliente.data).toLocaleDateString('pt-BR');
            let numWpp = cliente.whatsapp ? cliente.whatsapp.replace(/\D/g, '') : '';
            if (numWpp.length >= 10 && numWpp.length <= 11) numWpp = '55' + numWpp; 
            else if (!numWpp.startsWith('55') && numWpp.length >= 12) numWpp = '55' + numWpp; 
            
            const card = document.createElement('div');
            card.className = "bg-slate-900 border border-slate-700 rounded-xl p-4 hover:border-sky-500 transition shadow-lg flex flex-col";
            
            // CABEÇALHO (Sempre visível - Clicável para Minimizar/Maximizar)
            const htmlHeader = `
                <div class="flex justify-between items-center cursor-pointer select-none" onclick="window.toggleCard('${cliente.id}')">
                    <div class="flex-1">
                        <h4 class="font-bold text-white text-lg leading-tight">${cliente.nome}</h4>
                        <p class="text-xs text-sky-400 font-semibold uppercase tracking-wider">${cliente.empresa}</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-[10px] text-slate-500 bg-slate-800 px-2 py-1 rounded hidden md:block">${dataFormatada}</span>
                        <i id="icon-${cliente.id}" class='bx bx-chevron-down text-2xl text-slate-400 transition-transform duration-300'></i>
                    </div>
                </div>
            `;

            // CORPO (Escondido por padrão)
            const htmlBody = `
                <div id="body-${cliente.id}" class="hidden mt-4 pt-4 border-t border-slate-700">
                    <p class="text-sm text-slate-300 mb-4 italic">"${cliente.dores}"</p>
                    <div class="flex flex-wrap gap-2">
                        <button onclick="window.abrirModalProjeto('${cliente.id}')" class="flex-1 bg-sky-900/40 hover:bg-sky-600 text-white text-sm font-semibold py-2 px-3 rounded-lg transition border border-sky-800 flex items-center justify-center gap-2">
                            <i class='bx bx-terminal'></i> Abrir Fábrica
                        </button>
                        <a href="https://wa.me/${numWpp}" target="_blank" class="w-10 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center" title="Conversar"><i class='bx bxl-whatsapp text-lg'></i></a>
                        
                        ${abaAtiva === 'novos' 
                            ? `<button onclick="window.alterarStatus('${cliente.id}', 'concluido')" class="w-10 bg-emerald-900/50 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg flex items-center justify-center transition border border-emerald-800" title="Marcar como Sistema Gerado"><i class='bx bx-check-double text-lg'></i></button>`
                            : `<button onclick="window.alterarStatus('${cliente.id}', 'novo')" class="w-10 bg-orange-900/50 hover:bg-orange-600 text-orange-400 hover:text-white rounded-lg flex items-center justify-center transition border border-orange-800" title="Voltar para Novos Projetos"><i class='bx bx-undo text-lg'></i></button>`
                        }
                        
                        <button onclick="window.excluirProjeto('${cliente.id}')" class="w-10 bg-slate-800 hover:bg-red-700 text-slate-400 hover:text-white rounded-lg flex items-center justify-center transition"><i class='bx bx-trash text-lg'></i></button>
                    </div>
                </div>
            `;

            card.innerHTML = htmlHeader + htmlBody;
            gridLeads.appendChild(card);
        });
    }

    // --- FUNÇÕES DE AÇÃO DOS CARTÕES ---
    window.toggleCard = function(id) {
        const body = document.getElementById(`body-${id}`);
        const icon = document.getElementById(`icon-${id}`);
        if(body.classList.contains('hidden')) {
            body.classList.remove('hidden');
            icon.style.transform = 'rotate(180deg)';
        } else {
            body.classList.add('hidden');
            icon.style.transform = 'rotate(0deg)';
        }
    };

    window.alterarStatus = function(id, novoStatus) {
        set(ref(database, `projetos_capturados/${id}/status`), novoStatus);
    };

    window.excluirProjeto = function(id) {
        if (confirm("Deseja excluir definitivamente este projeto? A conversa com a IA também será apagada.")) {
            set(ref(database, `projetos_capturados/${id}`), null);
        }
    };

    // --- O ESTÚDIO DO ARQUITETO (MODAL + CHAT DEV) ---
    window.abrirModalProjeto = function(id) {
        // Encontra o cliente pelo ID e não mais pelo index (porque o filtro bagunça as posições)
        const c = listaDeClientesGlobais.find(item => item.id === id);
        if(!c) return;

        idProjetoAberto = c.id;
        historicoDevAtual = c.devChat || []; 

        document.getElementById('modal-nome').innerText = c.nome;
        document.getElementById('modal-empresa').innerText = c.empresa;
        document.getElementById('modal-dores').innerText = c.dores;
        
        let formataFacilitoide = c.facilitoide ? c.facilitoide.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong class="text-emerald-400">$1</strong>') : "Sem arquitetura.";
        document.getElementById('modal-facilitoide').innerHTML = formataFacilitoide;
        
        contextoProjetoAtual = `Cliente: ${c.nome}. Empresa: ${c.empresa}. Dor: ${c.dores}. A ideia do sistema a construir é: ${c.facilitoide}`;
        
        const chatDisplay = document.getElementById('dev-chat-display');
        chatDisplay.innerHTML = `<div class="msg-dev ai">Olá, Thiago! Sou a sua IA Desenvolvedora. Analisei a arquitetura deste projeto. Pode pedir os códigos e regras que precisa!</div>`;

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

    // --- LÓGICA DO CHAT DE PROGRAMAÇÃO ---
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

        const respostaDaIA = await conversarComDesenvolvedorIA(msg, contextoProjetoAtual, historicoDevAtual);

        const divAI = document.createElement('div');
        divAI.className = "msg-dev ai shadow-lg";
        divAI.innerHTML = formatarCodigoIA(respostaDaIA);
        chatDisplay.appendChild(divAI);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;

        historicoDevAtual.push({ role: 'user', text: msg });
        historicoDevAtual.push({ role: 'model', text: respostaDaIA });

        set(ref(database, `projetos_capturados/${idProjetoAberto}/devChat`), historicoDevAtual);

        devInput.disabled = false;
        devInput.focus();
        btnDevSend.innerHTML = "<i class='bx bx-send'></i>";
    }

    if(btnDevSend) btnDevSend.addEventListener('click', enviarMsgDev);
    if(devInput) devInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') enviarMsgDev(); });
});