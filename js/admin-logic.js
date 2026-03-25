// NOME DO FICHEIRO: admin-logic.js
// LOCALIZAÇÃO: Fica OBRIGATORIAMENTE dentro da pasta 'js' (Substitua tudo o que lá estiver)

import { auth, database, signInWithEmailAndPassword, signOut, onAuthStateChanged, ref, set, onValue, get } from './firebase-config.js';
import { atualizarPromptMemoria, systemPrompt as promptPadraoDaAPI, conversarComDesenvolvedorIA, resetarChatAdmin } from './gemini-api.js';

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
    let contextoProjetoAtual = ""; // Guarda o texto do projeto aberto para a IA saber sobre o que programar

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
            btnLogin.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> A ligar...";
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
                const dataFormatada = new Date(cliente.data).toLocaleDateString('pt-PT');
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
        if (confirm("Deseja eliminar este projeto da fábrica?")) set(ref(database, `projetos_capturados/${idProjeto}`), null);
    };

    // --- O ESTÚDIO DO ARQUITETO (MODAL + CHAT DEV) ---
    window.abrirModalProjeto = function(index) {
        const c = listaDeClientesGlobais[index];
        if(!c) return;

        document.getElementById('modal-nome').innerText = c.nome;
        document.getElementById('modal-empresa').innerText = c.empresa;
        document.getElementById('modal-dores').innerText = c.dores;
        
        let formataFacilitoide = c.facilitoide ? c.facilitoide.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong class="text-emerald-400">$1</strong>') : "Sem arquitetura.";
        document.getElementById('modal-facilitoide').innerHTML = formataFacilitoide;
        
        // Define o contexto que a IA vai ler para ajudar a programar
        contextoProjetoAtual = `Cliente: ${c.nome}. Empresa: ${c.empresa}. Dor: ${c.dores}. A ideia do sistema a construir é: ${c.facilitoide}`;
        
        resetarChatAdmin();
        const chatDisplay = document.getElementById('dev-chat-display');
        chatDisplay.innerHTML = `<div class="msg-dev ai">Olá, Thiago! Sou a sua IA Desenvolvedora. Analisei a arquitetura deste projeto. Pode pedir-me o código HTML, a lógica JS, ou as configurações de Firebase e Cloudinary que precisa.</div>`;

        let numModal = c.whatsapp ? c.whatsapp.replace(/\D/g, '') : '';
        if (numModal.length >= 10 && numModal.length <= 11) numModal = '55' + numModal;
        document.getElementById('modal-whatsapp').href = `https://wa.me/${numModal}`;

        if(modalProjeto) modalProjeto.classList.remove('oculto');
    };

    document.getElementById('btn-fechar-modal').addEventListener('click', () => modalProjeto.classList.add('oculto'));

    // --- LÓGICA DO CHAT DE PROGRAMAÇÃO (CANVAS ADMIN) ---
    const devInput = document.getElementById('dev-input');
    const btnDevSend = document.getElementById('btn-dev-send');
    const chatDisplay = document.getElementById('dev-chat-display');

    function formatarCodigoIA(texto) {
        // Formata os blocos de código Markdown para exibição bonita no ecrã
        return texto.replace(/```(.*?)\n([\s\S]*?)```/g, '<pre><code class="$1">$2</code></pre>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    }

    async function enviarMsgDev() {
        const msg = devInput.value.trim();
        if(!msg) return;

        devInput.value = '';
        devInput.disabled = true;
        btnDevSend.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i>";

        const divAdmin = document.createElement('div');
        divAdmin.className = "msg-dev admin";
        divAdmin.innerText = msg;
        chatDisplay.appendChild(divAdmin);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;

        // Chama a 2ª Mente da IA (A Desenvolvedora de Código)
        const respostaDaIA = await conversarComDesenvolvedorIA(msg, contextoProjetoAtual);

        const divAI = document.createElement('div');
        divAI.className = "msg-dev ai shadow-lg";
        divAI.innerHTML = formatarCodigoIA(respostaDaIA);
        chatDisplay.appendChild(divAI);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;

        devInput.disabled = false;
        devInput.focus();
        btnDevSend.innerHTML = "<i class='bx bx-send'></i>";
    }

    if(btnDevSend) btnDevSend.addEventListener('click', enviarMsgDev);
    if(devInput) devInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') enviarMsgDev(); });
});
