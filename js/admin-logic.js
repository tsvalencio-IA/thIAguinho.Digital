// NOME DO ARQUIVO: admin-logic.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { auth, database, signInWithEmailAndPassword, signOut, onAuthStateChanged, ref, set, onValue, get } from './firebase-config.js';
import { atualizarPromptMemoria, systemPrompt as promptPadraoDaAPI } from './gemini-api.js';

// Função global para copiar códigos (O botão do Canvas)
window.copiarCodigo = function(btnElement, codigoCodificado) {
    const codigoReal = decodeURIComponent(codigoCodificado);
    navigator.clipboard.writeText(codigoReal).then(() => {
        const textoOriginal = btnElement.innerHTML;
        btnElement.innerHTML = "<i class='bx bx-check'></i> Copiado!";
        btnElement.classList.replace("bg-slate-700", "bg-emerald-600");
        setTimeout(() => {
            btnElement.innerHTML = textoOriginal;
            btnElement.classList.replace("bg-emerald-600", "bg-slate-700");
        }, 2000);
    }).catch(err => console.error("Falha ao copiar", err));
};

document.addEventListener('DOMContentLoaded', () => {
    const emailInput = document.getElementById('email-admin');
    const senhaInput = document.getElementById('senha-admin');
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const erroMsg = document.getElementById('msg-erro-login');
    const btnSavePrompt = document.getElementById('btn-save-prompt');
    const btnSaveKey = document.getElementById('btn-save-key');
    const apiKeyInput = document.getElementById('api-key-input');
    const gridLeads = document.getElementById('grid-leads');
    const modalProjeto = document.getElementById('modal-projeto');
    
    let usuarioLogado = null;
    let listaDeClientesGlobais = [];

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
            signInWithEmailAndPassword(auth, emailInput.value, senhaInput.value).catch(() => {
                erroMsg.classList.remove('oculto');
                btnLogin.innerHTML = "Entrar no Painel";
            });
        });
    }

    if(btnLogout) {
        btnLogout.addEventListener('click', () => signOut(auth).then(() => window.location.reload()));
    }

    if(btnSaveKey) {
        btnSaveKey.addEventListener('click', () => {
            const novaChave = apiKeyInput.value.trim();
            if(!novaChave) return;
            btnSaveKey.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i>";
            set(ref(database, 'admin_config/gemini_api_key'), novaChave).then(() => {
                btnSaveKey.innerHTML = "<i class='bx bx-check'></i> Guardada";
                setTimeout(() => btnSaveKey.innerHTML = "Salvar", 2000);
            });
        });
    }

    if(btnSavePrompt) {
        btnSavePrompt.addEventListener('click', () => {
            const novoPrompt = document.getElementById('prompt-ia').value;
            const originalText = btnSavePrompt.innerHTML;
            btnSavePrompt.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Salvando...";
            set(ref(database, 'admin_config/prompt_mascote'), novoPrompt).then(() => {
                atualizarPromptMemoria(novoPrompt);
                btnSavePrompt.innerHTML = "<i class='bx bx-check'></i> Atualizado!";
                setTimeout(() => btnSavePrompt.innerHTML = originalText, 2000);
            });
        });
    }

    function iniciarLeituraDoBancoDeDados() {
        get(ref(database, 'admin_config/gemini_api_key')).then((snap) => { if(snap.exists() && apiKeyInput) apiKeyInput.value = snap.val(); });
        get(ref(database, 'admin_config/prompt_mascote')).then((snap) => {
            const caixaTexto = document.getElementById('prompt-ia');
            if (snap.exists()) {
                if(caixaTexto) caixaTexto.value = snap.val();
                atualizarPromptMemoria(snap.val());
            } else {
                if(caixaTexto) caixaTexto.value = promptPadraoDaAPI;
            }
        });

        onValue(ref(database, 'projetos_capturados'), (snapshot) => {
            if(!gridLeads) return;
            gridLeads.innerHTML = ''; 
            if (!snapshot.exists()) {
                gridLeads.innerHTML = '<div class="col-span-full text-center py-10 text-slate-500"><p>Nenhum código gerado ainda.</p></div>';
                return;
            }

            listaDeClientesGlobais = [];
            snapshot.forEach((filho) => listaDeClientesGlobais.push({ id: filho.key, ...filho.val() }));
            listaDeClientesGlobais.sort((a, b) => new Date(b.data) - new Date(a.data));

            listaDeClientesGlobais.forEach((cliente, index) => {
                const dataFormatada = new Date(cliente.data).toLocaleDateString('pt-BR');
                let numeroLimpo = cliente.whatsapp ? cliente.whatsapp.replace(/\D/g, '') : '';
                if (numeroLimpo.length >= 10 && numeroLimpo.length <= 11) numeroLimpo = '55' + numeroLimpo; 
                
                const card = document.createElement('div');
                card.className = "bg-slate-900 border border-slate-700 rounded-xl p-5 hover:border-red-500 transition shadow-lg flex flex-col justify-between";
                card.innerHTML = `
                    <div>
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <h4 class="font-bold text-white text-lg leading-tight">${cliente.nome}</h4>
                                <p class="text-xs text-slate-400 font-semibold uppercase tracking-wider">${cliente.empresa}</p>
                            </div>
                            <span class="text-[10px] text-slate-500 bg-slate-800 px-2 py-1 rounded">${dataFormatada}</span>
                        </div>
                        <p class="text-sm text-slate-300 line-clamp-2 mb-4 italic">"${cliente.dores}"</p>
                    </div>
                    
                    <div class="border-t border-slate-700 pt-4 mt-auto flex gap-2">
                        <button onclick="window.abrirModalProjeto(${index})" class="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold py-2 rounded-lg transition border border-slate-600 flex items-center justify-center gap-2">
                            <i class='bx bx-code-block'></i> Ver Códigos
                        </button>
                        <a href="https://wa.me/${numeroLimpo}?text=${encodeURIComponent(`Olá ${cliente.nome}! Nossa IA já construiu e programou a estrutura do seu novo sistema. Podemos conversar?`)}" target="_blank" class="w-10 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center" title="Iniciar Venda">
                            <i class='bx bxl-whatsapp text-lg'></i>
                        </a>
                        <button onclick="window.excluirProjeto('${cliente.id}')" class="w-10 bg-red-900 hover:bg-red-700 text-white rounded-lg flex items-center justify-center">
                            <i class='bx bx-trash text-lg'></i>
                        </button>
                    </div>
                `;
                gridLeads.appendChild(card);
            });
        });
    }

    window.excluirProjeto = function(idProjeto) {
        if (confirm("Excluir este código de projeto permanentemente?")) {
            set(ref(database, `projetos_capturados/${idProjeto}`), null);
        }
    };

    // --- FORMATADOR DE CÓDIGO (ESTILO CANVAS) ---
    function formatarComoCanvas(texto) {
        if(!texto) return "Nenhum dado recebido.";
        
        // 1. Formata negritos e quebras de linha normais
        let html = texto.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>');
        
        // 2. Extrai blocos de código ```linguagem ... ``` e cria as Caixas Negras com botão Copiar
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, function(match, linguagem, codigo) {
            const langName = linguagem ? linguagem.toUpperCase() : 'CÓDIGO';
            const codigoEncode = encodeURIComponent(codigo.trim());
            const codigoSafe = codigo.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
            
            return `
            <div class="bg-[#0d1117] rounded-xl border border-slate-600 my-5 overflow-hidden shadow-2xl">
                <div class="flex justify-between items-center bg-[#161b22] px-4 py-3 border-b border-slate-700">
                    <span class="text-xs text-slate-400 font-mono uppercase flex items-center gap-2"><i class='bx bx-code-alt'></i> ${langName}</span>
                    <button onclick="window.copiarCodigo(this, '${codigoEncode}')" class="text-xs bg-slate-700 hover:bg-slate-600 text-white px-4 py-1.5 rounded-lg transition font-semibold flex items-center gap-1 shadow"><i class='bx bx-copy'></i> Copiar</button>
                </div>
                <div class="p-4 overflow-x-auto bg-[#0d1117]">
                    <pre class="text-[13px] text-emerald-400 font-mono leading-relaxed"><code>${codigoSafe}</code></pre>
                </div>
            </div>`;
        });
        
        // Aplica quebras de linha (<br>) apenas FORA dos blocos de código
        return html.replace(/\n(?![^<]*<\/code>)/g, '<br>');
    }

    window.abrirModalProjeto = function(index) {
        const c = listaDeClientesGlobais[index];
        if(!c) return;

        document.getElementById('modal-nome').innerText = c.nome;
        document.getElementById('modal-empresa').innerText = c.empresa;
        document.getElementById('modal-dores').innerText = c.dores;
        
        // Aplica a formatação de caixas de código ao Facilitóide
        document.getElementById('modal-facilitoide').innerHTML = formatarComoCanvas(c.facilitoide);
        
        let wpp = c.whatsapp ? c.whatsapp.replace(/\D/g, '') : '';
        if (wpp.length >= 10 && wpp.length <= 11) wpp = '55' + wpp;

        document.getElementById('modal-whatsapp').href = `https://wa.me/${wpp}?text=${encodeURIComponent(`Olá ${c.nome}! Nossa IA já programou o código-fonte do seu sistema. Podemos marcar uma reunião?`)}`;
        if(modalProjeto) modalProjeto.classList.remove('oculto');
    };

    const fecharModal = () => { if(modalProjeto) modalProjeto.classList.add('oculto'); };
    document.getElementById('btn-fechar-modal')?.addEventListener('click', fecharModal);
    document.getElementById('btn-fechar-modal-2')?.addEventListener('click', fecharModal);
});
