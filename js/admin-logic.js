// NOME DO ARQUIVO: admin-logic.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { auth, database, signInWithEmailAndPassword, signOut, onAuthStateChanged, ref, set, onValue, get } from './firebase-config.js';
import { conversarComDesenvolvedorIA } from './gemini-api.js';

document.addEventListener('DOMContentLoaded', () => {
    
    const emailInput = document.getElementById('email-admin');
    const senhaInput = document.getElementById('senha-admin');
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const erroMsg = document.getElementById('msg-erro-login');
    
    const apiKeyInput = document.getElementById('api-key-input');
    const elevenKeyInput = document.getElementById('eleven-key-input');
    const elevenVoiceInput = document.getElementById('eleven-voice-input');
    const gridLeads = document.getElementById('grid-leads');
    
    let usuarioLogado = null;
    let listaDeClientesGlobais = [];
    let abaAtiva = 'novos'; 
    let contextoProjetoAtual = ""; 
    let idProjetoAberto = null;
    let historicoDevAtual = [];
    let bufferArquivosAnexados = "";

    function escapeHtml(unsafe) {
        return (unsafe || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // --- A MÁGICA: FORMATADOR COM PREVIEW E DOWNLOAD ---
    function formatarCodigoIA(texto) {
        if(!texto) return "";
        
        let textoFormatado = String(texto).replace(/```(html|javascript|js|css|json)?\n([\s\S]*?)```/gi, function(match, lang, code) {
            const linguagem = lang ? lang.toLowerCase() : 'código';
            const safeCode = escapeHtml(code);
            const blockId = 'code-' + Math.random().toString(36).substr(2, 9);
            
            let botoes = `<button onclick="navigator.clipboard.writeText(document.getElementById('${blockId}').innerText); this.innerText='Copiado!'; setTimeout(()=>this.innerText='Copiar',2000)" class="bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded transition text-[10px] font-bold"><i class='bx bx-copy'></i> Copiar</button>`;
            
            // Se for código programável, adiciona o Botão de Baixar Arquivo
            if (['html', 'javascript', 'js', 'css'].includes(linguagem)) {
                let ext = linguagem === 'javascript' ? 'js' : linguagem;
                botoes += `<button onclick="window.baixarCodigo('${blockId}', '${ext}')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded ml-2 transition text-[10px] font-bold"><i class='bx bx-download'></i> Baixar Demo</button>`;
            }

            if (linguagem === 'html') {
                botoes += `<button onclick="window.abrirPreview('${blockId}')" class="bg-sky-600 hover:bg-sky-500 text-white px-2 py-1 rounded ml-2 transition text-[10px] font-bold"><i class='bx bx-play'></i> Visualizar</button>`;
            }

            return `
            <div class="code-container">
                <div class="code-header">
                    <span class="uppercase font-bold">${linguagem}</span>
                    <div class="flex gap-2">${botoes}</div>
                </div>
                <div class="code-content">
                    <code id="${blockId}">${safeCode}</code>
                </div>
            </div>`;
        });

        return textoFormatado.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    }

    // --- FUNÇÃO PARA BAIXAR O ARQUIVO DIRETO PRO CELULAR/PC ---
    window.baixarCodigo = function(blockId, extensao) {
        const codigoRaw = document.getElementById(blockId).innerText;
        const blob = new Blob([codigoRaw], { type: 'text/plain;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `projeto_demo.${extensao}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    window.abrirPreview = function(blockId) {
        const codigoRaw = document.getElementById(blockId).innerText;
        const janelaPreview = window.open("", "_blank");
        janelaPreview.document.write(codigoRaw);
        janelaPreview.document.close();
    };

    // --- CONTROLES E LOGIN (Ocultado para resumir, igual ao anterior) ---
    const tabNovos = document.getElementById('tab-novos');
    const tabConcluidos = document.getElementById('tab-concluidos');

    if(tabNovos && tabConcluidos) {
        tabNovos.addEventListener('click', () => { abaAtiva = 'novos'; tabNovos.classList.replace('text-slate-400', 'text-white'); tabNovos.classList.add('border-b-2', 'border-red-500'); tabConcluidos.classList.replace('text-white', 'text-slate-400'); tabConcluidos.classList.remove('border-b-2', 'border-red-500'); renderizarProjetos(); });
        tabConcluidos.addEventListener('click', () => { abaAtiva = 'concluidos'; tabConcluidos.classList.replace('text-slate-400', 'text-white'); tabConcluidos.classList.add('border-b-2', 'border-red-500'); tabNovos.classList.replace('text-white', 'text-slate-400'); tabNovos.classList.remove('border-b-2', 'border-red-500'); renderizarProjetos(); });
    }

    onAuthStateChanged(auth, (user) => {
        if (user) { usuarioLogado = user; if(erroMsg) erroMsg.classList.add('oculto'); document.getElementById('admin-login')?.classList.add('oculto'); document.getElementById('admin-dashboard')?.classList.remove('oculto'); iniciarLeituraDoBancoDeDados(); } 
        else { usuarioLogado = null; document.getElementById('admin-dashboard')?.classList.add('oculto'); document.getElementById('admin-login')?.classList.remove('oculto'); }
    });

    if(btnLogin) btnLogin.addEventListener('click', () => { btnLogin.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i>"; signInWithEmailAndPassword(auth, emailInput.value, senhaInput.value).catch(() => { erroMsg.classList.remove('oculto'); btnLogin.innerHTML = "Entrar no Painel"; }); });
    if(btnLogout) btnLogout.addEventListener('click', () => signOut(auth).then(() => window.location.reload()));

    // Salvar Chaves do Gemini e da ElevenLabs
    if(document.getElementById('btn-save-key')) {
        document.getElementById('btn-save-key').addEventListener('click', () => {
            if (!usuarioLogado || !apiKeyInput.value.trim()) return;
            const btn = document.getElementById('btn-save-key'); btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i>";
            set(ref(database, 'admin_config/gemini_api_key'), apiKeyInput.value.trim()).then(() => { btn.innerHTML = "Salva"; setTimeout(() => btn.innerHTML = "Salvar", 2000); });
        });
    }
    
    if(document.getElementById('btn-save-voice')) {
        document.getElementById('btn-save-voice').addEventListener('click', () => {
            if (!usuarioLogado) return;
            const btn = document.getElementById('btn-save-voice'); btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i>";
            set(ref(database, 'admin_config/elevenlabs_api_key'), elevenKeyInput.value.trim());
            set(ref(database, 'admin_config/elevenlabs_voice_id'), elevenVoiceInput.value.trim()).then(() => { btn.innerHTML = "Salvo!"; setTimeout(() => btn.innerHTML = "Salvar Voz", 2000); });
        });
    }

    function iniciarLeituraDoBancoDeDados() {
        get(ref(database, 'admin_config/gemini_api_key')).then((s) => { if(s.exists() && apiKeyInput) apiKeyInput.value = s.val(); });
        get(ref(database, 'admin_config/elevenlabs_api_key')).then((s) => { if(s.exists() && elevenKeyInput) elevenKeyInput.value = s.val(); });
        get(ref(database, 'admin_config/elevenlabs_voice_id')).then((s) => { if(s.exists() && elevenVoiceInput) elevenVoiceInput.value = s.val(); });

        onValue(ref(database, 'projetos_capturados'), (snapshot) => {
            listaDeClientesGlobais = [];
            if (snapshot.exists()) { snapshot.forEach((filho) => { listaDeClientesGlobais.push({ id: filho.key, ...filho.val() }); }); listaDeClientesGlobais.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0)); }
            renderizarProjetos();
        });
    }

    function renderizarProjetos() {
        if(!gridLeads) return; gridLeads.innerHTML = ''; 
        const projetosFiltrados = listaDeClientesGlobais.filter(cliente => { const status = cliente.status || 'novo'; return abaAtiva === 'novos' ? status === 'novo' : status === 'concluido'; });
        if (projetosFiltrados.length === 0) { gridLeads.innerHTML = `<div class="col-span-full text-center py-10 text-slate-500"><i class='bx bx-sleepy text-4xl mb-3'></i><p>Nenhum projeto nesta aba.</p></div>`; return; }

        projetosFiltrados.forEach(cliente => {
            const dataFormatada = cliente.data ? new Date(cliente.data).toLocaleDateString('pt-BR') : 'Sem data';
            let numWpp = cliente.whatsapp ? String(cliente.whatsapp).replace(/\D/g, '') : '';
            if (numWpp.length >= 10 && numWpp.length <= 11) numWpp = '55' + numWpp; 
            
            const card = document.createElement('div');
            card.className = "w-full shrink-0 bg-slate-900 border border-slate-700 rounded-xl p-4 hover:border-sky-500 transition shadow-lg flex flex-col mb-2";
            
            const htmlHeader = `
                <div class="flex justify-between items-center cursor-pointer select-none" onclick="window.toggleCard('${cliente.id}')">
                    <div class="flex-1 overflow-hidden">
                        <h4 class="font-bold text-white text-lg leading-tight truncate">${cliente.nome || "Cliente Indefinido"}</h4>
                        <p class="text-xs text-sky-400 font-semibold uppercase tracking-wider truncate">${cliente.empresa || "Sem Empresa"}</p>
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                        <span class="text-[10px] text-slate-500 bg-slate-800 px-2 py-1 rounded hidden md:block">${dataFormatada}</span>
                        <i id="icon-${cliente.id}" class='bx bx-chevron-down text-2xl text-slate-400 transition-transform duration-300'></i>
                    </div>
                </div>
            `;

            const htmlBody = `
                <div id="body-${cliente.id}" class="hidden mt-4 pt-4 border-t border-slate-700">
                    <p class="text-xs md:text-sm text-slate-300 mb-4 italic">"${cliente.dores || "Não informou dores específicas."}"</p>
                    <div class="flex flex-wrap gap-2">
                        <button onclick="window.abrirModalProjeto('${cliente.id}')" class="flex-1 bg-sky-900/40 hover:bg-sky-600 text-white text-xs md:text-sm font-semibold py-2 px-3 rounded-lg transition border border-sky-800 flex items-center justify-center gap-2 min-w-[120px]">
                            <i class='bx bx-terminal'></i> Abrir Fábrica
                        </button>
                        <a href="https://wa.me/${numWpp}" target="_blank" class="w-10 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center shrink-0" title="Conversar no WhatsApp"><i class='bx bxl-whatsapp text-lg'></i></a>
                        
                        ${abaAtiva === 'novos' 
                            ? `<button onclick="window.alterarStatus('${cliente.id}', 'concluido')" class="w-10 bg-emerald-900/50 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg flex items-center justify-center transition border border-emerald-800 shrink-0" title="Marcar como Sistema Gerado"><i class='bx bx-check-double text-lg'></i></button>`
                            : `<button onclick="window.alterarStatus('${cliente.id}', 'novo')" class="w-10 bg-orange-900/50 hover:bg-orange-600 text-orange-400 hover:text-white rounded-lg flex items-center justify-center transition border border-orange-800 shrink-0" title="Voltar para Novos Projetos"><i class='bx bx-undo text-lg'></i></button>`
                        }
                        
                        <button onclick="window.excluirProjeto('${cliente.id}')" class="w-10 bg-slate-800 hover:bg-red-700 text-slate-400 hover:text-white rounded-lg flex items-center justify-center transition shrink-0"><i class='bx bx-trash text-lg'></i></button>
                    </div>
                </div>
            `;
            card.innerHTML = htmlHeader + htmlBody;
            gridLeads.appendChild(card);
        });
    }

    window.toggleCard = function(id) { const b = document.getElementById(`body-${id}`); const i = document.getElementById(`icon-${id}`); if(b && i) { b.classList.toggle('hidden'); i.style.transform = b.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)'; } };
    window.alterarStatus = function(id, novoStatus) { set(ref(database, `projetos_capturados/${id}/status`), novoStatus); };
    window.excluirProjeto = function(id) { if (confirm("Deseja excluir definitivamente este projeto?")) set(ref(database, `projetos_capturados/${id}`), null); };

    // --- MODAL DE PROGRAMAÇÃO DA FÁBRICA ---
    window.abrirModalProjeto = function(id) {
        const c = listaDeClientesGlobais.find(item => item.id === id);
        if(!c) return;

        idProjetoAberto = c.id;
        let chatSalvo = c.devChat || [];
        if (typeof chatSalvo === 'string') historicoDevAtual = [{role: 'model', text: chatSalvo}];
        else if (!Array.isArray(chatSalvo) && typeof chatSalvo === 'object') historicoDevAtual = Object.values(chatSalvo);
        else historicoDevAtual = chatSalvo;
        
        bufferArquivosAnexados = ""; 

        if(document.getElementById('modal-nome')) document.getElementById('modal-nome').innerText = c.nome || "Cliente";
        if(document.getElementById('modal-empresa')) document.getElementById('modal-empresa').innerText = c.empresa || "Empresa";
        if(document.getElementById('modal-dores')) document.getElementById('modal-dores').innerText = c.dores || "Sem dor detalhada.";
        
        contextoProjetoAtual = `Cliente: ${c.nome}. Empresa: ${c.empresa}. Dor: ${c.dores}.`;
        
        const chatDisplay = document.getElementById('dev-chat-display');
        if(chatDisplay) {
            chatDisplay.innerHTML = `<div class="msg-dev ai">Olá, Thiago! O que vamos codificar para este cliente? Você pode pedir um arquivo HTML único de demonstração e baixar direto pro seu celular clicando em "Baixar Demo"!</div>`;

            if(Array.isArray(historicoDevAtual)) {
                historicoDevAtual.forEach(msg => {
                    if(!msg || !msg.text) return;
                    const textoSeguro = String(msg.text);
                    const div = document.createElement('div');
                    div.className = `msg-dev ${msg.role === 'user' ? 'admin' : 'ai shadow-lg w-full'}`;
                    div.innerHTML = msg.role === 'user' ? textoSeguro.replace(/\n/g, '<br>') : formatarCodigoIA(textoSeguro);
                    chatDisplay.appendChild(div);
                });
            }
            chatDisplay.scrollTop = chatDisplay.scrollHeight;
        }
        
        const modalDOM = document.getElementById('modal-projeto');
        if(modalDOM) modalDOM.classList.remove('oculto');
    };

    if(document.getElementById('btn-fechar-modal')) { document.getElementById('btn-fechar-modal').addEventListener('click', () => { document.getElementById('modal-projeto').classList.add('oculto'); }); }

    // --- LÓGICA DO CHAT DE CÓDIGO ---
    const devInput = document.getElementById('dev-input');
    const btnDevSend = document.getElementById('btn-dev-send');
    const devFile = document.getElementById('dev-file');
    const chatDisplay = document.getElementById('dev-chat-display');

    if(devFile) {
        devFile.addEventListener('change', async (e) => {
            const files = e.target.files;
            if(files.length === 0) return;
            for(let file of files) {
                try {
                    const text = await file.text();
                    bufferArquivosAnexados += `\n\n--- INÍCIO DO ARQUIVO: ${file.name} ---\n${text}\n--- FIM DO ARQUIVO ---\n`;
                    const divAdmin = document.createElement('div');
                    divAdmin.className = "msg-dev admin bg-slate-700 text-slate-200 text-xs italic";
                    divAdmin.innerHTML = `<i class='bx bx-file'></i> Anexado: <b>${file.name}</b>`;
                    if(chatDisplay) { chatDisplay.appendChild(divAdmin); chatDisplay.scrollTop = chatDisplay.scrollHeight; }
                } catch(err) { console.error(err); }
            }
            devFile.value = ''; 
        });
    }

    async function enviarMsgDev() {
        let msg = devInput ? devInput.value.trim() : "";
        if(!msg && !bufferArquivosAnexados) return; 

        if(devInput) devInput.value = '';
        if(devInput) devInput.disabled = true;
        if(btnDevSend) btnDevSend.innerHTML = "<i class='bx bx-loader-alt bx-spin text-xl'></i>";

        if(msg && chatDisplay) {
            const divAdmin = document.createElement('div');
            divAdmin.className = "msg-dev admin";
            divAdmin.innerText = msg;
            chatDisplay.appendChild(divAdmin);
        }

        const msgFinalParaIA = msg + "\n" + bufferArquivosAnexados;
        bufferArquivosAnexados = ""; 
        if(chatDisplay) chatDisplay.scrollTop = chatDisplay.scrollHeight;

        const respostaDaIA = await conversarComDesenvolvedorIA(msgFinalParaIA, contextoProjetoAtual, historicoDevAtual);

        if(chatDisplay) {
            const divAI = document.createElement('div');
            divAI.className = "msg-dev ai shadow-lg w-full overflow-hidden";
            divAI.innerHTML = formatarCodigoIA(respostaDaIA);
            chatDisplay.appendChild(divAI);
            chatDisplay.scrollTop = chatDisplay.scrollHeight;
        }

        historicoDevAtual.push({ role: 'user', text: msg ? msg : "Envio de arquivos." });
        historicoDevAtual.push({ role: 'model', text: respostaDaIA });
        set(ref(database, `projetos_capturados/${idProjetoAberto}/devChat`), historicoDevAtual);

        if(devInput) devInput.disabled = false;
        if(devInput) devInput.focus();
        if(btnDevSend) btnDevSend.innerHTML = "<i class='bx bx-send text-lg md:text-xl'></i>";
    }

    if(btnDevSend) btnDevSend.addEventListener('click', enviarMsgDev);
    if(devInput) devInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') enviarMsgDev(); });
});