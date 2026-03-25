// NOME DO ARQUIVO: admin-logic.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { auth, database, signInWithEmailAndPassword, signOut, onAuthStateChanged, ref, set, onValue, get } from './firebase-config.js';
import { atualizarPromptMemoria, systemPrompt as promptPadraoDaAPI } from './gemini-api.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // Elementos de Autenticação
    const emailInput = document.getElementById('email-admin');
    const senhaInput = document.getElementById('senha-admin');
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const erroMsg = document.getElementById('msg-erro-login');
    
    // Elementos de Configuração
    const btnSavePrompt = document.getElementById('btn-save-prompt');
    const btnSaveKey = document.getElementById('btn-save-key');
    const apiKeyInput = document.getElementById('api-key-input');
    const gridLeads = document.getElementById('grid-leads');
    
    // Elementos do Modal
    const modalProjeto = document.getElementById('modal-projeto');
    const btnFecharModal = document.getElementById('btn-fechar-modal');
    const btnFecharModal2 = document.getElementById('btn-fechar-modal-2');
    
    let usuarioLogado = null;
    let listaDeClientesGlobais = [];

    // --- 1. MANTER SESSÃO SALVA (LOGIN AUTOMÁTICO) ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // O usuário já tem sessão ativa, salta a tela de login!
            usuarioLogado = user;
            if(erroMsg) erroMsg.classList.add('oculto');
            document.getElementById('admin-login').classList.add('oculto');
            document.getElementById('admin-dashboard').classList.remove('oculto');
            iniciarLeituraDoBancoDeDados();
        } else {
            // Sessão expirada ou usuário saiu
            usuarioLogado = null;
            document.getElementById('admin-dashboard').classList.add('oculto');
            document.getElementById('admin-login').classList.remove('oculto');
        }
    });

    // --- 2. LOGIN MANUAL ---
    if(btnLogin) {
        btnLogin.addEventListener('click', () => {
            btnLogin.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Conectando...";
            
            signInWithEmailAndPassword(auth, emailInput.value, senhaInput.value)
                .then((userCredential) => {
                    // A transição de tela será feita pelo onAuthStateChanged acima
                })
                .catch((error) => {
                    console.error("Erro Auth Firebase:", error);
                    erroMsg.classList.remove('oculto');
                    btnLogin.innerHTML = "Entrar no Painel";
                });
        });
    }

    // --- 3. SAIR DO PAINEL ---
    if(btnLogout) {
        btnLogout.addEventListener('click', () => {
            signOut(auth).then(() => {
                emailInput.value = '';
                senhaInput.value = '';
                if(btnLogin) btnLogin.innerHTML = "Entrar no Painel";
            });
        });
    }

    // --- 4. GUARDAR A CHAVE DA API ---
    if(btnSaveKey) {
        btnSaveKey.addEventListener('click', () => {
            if (!usuarioLogado) return;
            const novaChave = apiKeyInput.value.trim();
            if(!novaChave) return alert("Por favor, cole a chave da API do Gemini no campo.");
            
            const btn = btnSaveKey;
            btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i>";
            
            set(ref(database, 'admin_config/gemini_api_key'), novaChave)
                .then(() => {
                    btn.innerHTML = "<i class='bx bx-check'></i> Guardada";
                    btn.classList.replace('bg-red-600', 'bg-emerald-600');
                    setTimeout(() => {
                        btn.innerHTML = "Guardar";
                        btn.classList.replace('bg-emerald-600', 'bg-red-600');
                    }, 2000);
                })
                .catch((error) => alert("Erro ao guardar chave: " + error.message));
        });
    }

    // --- 5. GUARDAR A LÓGICA DO ARQUITETO (CÉREBRO) ---
    if(btnSavePrompt) {
        btnSavePrompt.addEventListener('click', () => {
            if (!usuarioLogado) return;
            const btn = btnSavePrompt;
            const originalText = btn.innerHTML;
            btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Salvando...";
            
            const novoPrompt = document.getElementById('prompt-ia').value;
            set(ref(database, 'admin_config/prompt_mascote'), novoPrompt)
                .then(() => {
                    atualizarPromptMemoria(novoPrompt);
                    btn.innerHTML = "<i class='bx bx-check'></i> Atualizado com sucesso!";
                    btn.classList.replace('bg-red-600', 'bg-emerald-600');
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.classList.replace('bg-emerald-600', 'bg-red-600');
                    }, 2000);
                })
                .catch((error) => {
                    alert("Erro ao guardar no Firebase: " + error.message);
                    btn.innerHTML = originalText;
                });
        });
    }

    // --- 6. LER DADOS DO BACKEND E RENDERIZAR OS PROJETOS ---
    function iniciarLeituraDoBancoDeDados() {
        
        // Carrega a Chave API se existir
        get(ref(database, 'admin_config/gemini_api_key')).then((snapshot) => {
            if(snapshot.exists() && apiKeyInput) apiKeyInput.value = snapshot.val();
        });

        // Carrega o Comportamento da IA
        get(ref(database, 'admin_config/prompt_mascote')).then((snapshot) => {
            const caixaTexto = document.getElementById('prompt-ia');
            if (snapshot.exists()) {
                const promptSalvoNoFirebase = snapshot.val();
                if(caixaTexto) caixaTexto.value = promptSalvoNoFirebase;
                atualizarPromptMemoria(promptSalvoNoFirebase);
            } else {
                if(caixaTexto) caixaTexto.value = promptPadraoDaAPI;
            }
        });

        // Escuta os Novos Facilitóides (CRM)
        onValue(ref(database, 'projetos_capturados'), (snapshot) => {
            if(!gridLeads) return;
            gridLeads.innerHTML = ''; 
            
            if (!snapshot.exists()) {
                gridLeads.innerHTML = '<div class="col-span-full text-center py-10 text-slate-500"><i class="bx bx-sleepy text-4xl mb-3"></i><p>Nenhum Facilitóide desenhado ainda.</p></div>';
                return;
            }

            listaDeClientesGlobais = [];
            snapshot.forEach((filho) => {
                listaDeClientesGlobais.push({ id: filho.key, ...filho.val() });
            });
            
            listaDeClientesGlobais.sort((a, b) => new Date(b.data) - new Date(a.data));

            listaDeClientesGlobais.forEach((cliente, index) => {
                const dataFormatada = new Date(cliente.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                const numeroLimpo = cliente.whatsapp ? cliente.whatsapp.replace(/\D/g, '') : '';
                
                // Construção do Cartão de Usabilidade com NOVO BOTÃO DE EXCLUIR
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
                            <i class='bx bx-search-alt-2'></i> Ver Sistema
                        </button>
                        <a href="https://wa.me/55${numeroLimpo}?text=${encodeURIComponent(`Olá ${cliente.nome}, sou o Thiago da thIAguinho Soluções. Vi que conversou com o nosso arquiteto IA e ele desenhou um Facilitóide incrível para a ${cliente.empresa}. Podemos conversar?`)}" target="_blank" class="w-10 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center transition" title="Iniciar Venda">
                            <i class='bx bxl-whatsapp text-lg'></i>
                        </a>
                        <button onclick="window.excluirProjeto('${cliente.id}')" class="w-10 bg-red-900 hover:bg-red-700 text-white rounded-lg flex items-center justify-center transition" title="Excluir Projeto">
                            <i class='bx bx-trash text-lg'></i>
                        </button>
                    </div>
                `;
                gridLeads.appendChild(card);
            });
        });
    }

    // --- 7. FUNÇÃO PARA EXCLUIR PROJETO DO BANCO ---
    window.excluirProjeto = function(idProjeto) {
        if (confirm("Tem certeza que deseja excluir este projeto definitivamente? Esta ação não poderá ser desfeita.")) {
            // O Firebase exclui o item quando definimos seu valor como null
            set(ref(database, `projetos_capturados/${idProjeto}`), null)
                .catch((error) => {
                    alert("Erro ao excluir o projeto: " + error.message);
                });
        }
    };

    // --- 8. LÓGICA DA JANELA DE USABILIDADE (MODAL) ---
    window.abrirModalProjeto = function(index) {
        const c = listaDeClientesGlobais[index];
        if(!c) return;

        document.getElementById('modal-nome').innerText = c.nome;
        document.getElementById('modal-empresa').innerText = c.empresa;
        document.getElementById('modal-dores').innerText = c.dores;
        
        document.getElementById('modal-facilitoide').innerHTML = c.facilitoide ? c.facilitoide.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') : "<i>A IA não gerou uma arquitetura específica para este caso.</i>";
        
        const whatsLimpo = c.whatsapp ? c.whatsapp.replace(/\D/g, '') : '';
        const msgWhats = encodeURIComponent(`Olá ${c.nome}, sou o Thiago da thIAguinho Soluções. O nosso Arquiteto IA construiu um projeto exclusivo para a dor da ${c.empresa}. Vamos agendar uma reunião para fechar este negócio?`);
        document.getElementById('modal-whatsapp').href = `https://wa.me/55${whatsLimpo}?text=${msgWhats}`;

        if(modalProjeto) modalProjeto.classList.remove('oculto');
    };

    const fecharModal = () => {
        if(modalProjeto) modalProjeto.classList.add('oculto');
    };
    
    if(btnFecharModal) btnFecharModal.addEventListener('click', fecharModal);
    if(btnFecharModal2) btnFecharModal2.addEventListener('click', fecharModal);
});