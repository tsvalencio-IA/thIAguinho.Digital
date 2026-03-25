// NOME DO ARQUIVO: admin-logic.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { auth, database, signInWithEmailAndPassword, signOut, onAuthStateChanged, ref, set, onValue, get } from './firebase-config.js';
import { atualizarPromptMemoria, systemPrompt as promptPadraoDaAPI } from './gemini-api.js';

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
    const btnFecharModal = document.getElementById('btn-fechar-modal');
    const btnFecharModal2 = document.getElementById('btn-fechar-modal-2');
    
    let usuarioLogado = null;
    let listaDeClientesGlobais = [];

    // --- SESSÃO AUTOMÁTICA ---
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
                .catch((error) => {
                    console.error("Erro Auth Firebase:", error);
                    erroMsg.classList.remove('oculto');
                    btnLogin.innerHTML = "Entrar no Painel";
                });
        });
    }

    if(btnLogout) {
        btnLogout.addEventListener('click', () => {
            signOut(auth).then(() => {
                emailInput.value = '';
                senhaInput.value = '';
                if(btnLogin) btnLogin.innerHTML = "Entrar no Painel";
            });
        });
    }

    // --- SALVAR A CHAVE DA API ---
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
                        btn.innerHTML = "Salvar";
                        btn.classList.replace('bg-emerald-600', 'bg-red-600');
                    }, 2000);
                })
                .catch((error) => alert("Erro ao guardar chave: " + error.message));
        });
    }

    // --- SALVAR O CÉREBRO DA IA ---
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

    // --- LER DADOS DO BACKEND E RENDERIZAR OS PROJETOS ---
    function iniciarLeituraDoBancoDeDados() {
        get(ref(database, 'admin_config/gemini_api_key')).then((snapshot) => {
            if(snapshot.exists() && apiKeyInput) apiKeyInput.value = snapshot.val();
        });

        get(ref(database, 'admin_config/prompt_mascote')).then((snapshot) => {
            const caixaTexto = document.getElementById('prompt-ia');
            if (snapshot.exists()) {
                const promptSalvo = snapshot.val();
                if(caixaTexto) caixaTexto.value = promptSalvo;
                atualizarPromptMemoria(promptSalvo);
            } else {
                if(caixaTexto) caixaTexto.value = promptPadraoDaAPI;
            }
        });

        // Escuta os Facilitóides Gerados (CRM)
        onValue(ref(database, 'projetos_capturados'), (snapshot) => {
            if(!gridLeads) return;
            gridLeads.innerHTML = ''; 
            
            if (!snapshot.exists()) {
                gridLeads.innerHTML = '<div class="col-span-full text-center py-10 text-slate-500"><i class="bx bx-sleepy text-4xl mb-3"></i><p>Nenhum Facilitóide desenhado ainda. Mande o QR Code para os clientes!</p></div>';
                return;
            }

            listaDeClientesGlobais = [];
            snapshot.forEach((filho) => {
                listaDeClientesGlobais.push({ id: filho.key, ...filho.val() });
            });
            
            listaDeClientesGlobais.sort((a, b) => new Date(b.data) - new Date(a.data));

            listaDeClientesGlobais.forEach((cliente, index) => {
                const dataFormatada = new Date(cliente.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                
                // LÓGICA DE CORREÇÃO DO WHATSAPP
                let numeroLimpo = cliente.whatsapp ? cliente.whatsapp.replace(/\D/g, '') : '';
                if (numeroLimpo.length >= 10 && numeroLimpo.length <= 11) {
                    numeroLimpo = '55' + numeroLimpo; 
                } else if (!numeroLimpo.startsWith('55') && numeroLimpo.length >= 12) {
                     numeroLimpo = '55' + numeroLimpo; 
                }
                
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
                            <i class='bx bx-search-alt-2'></i> Abrir Projeto
                        </button>
                        <a href="https://wa.me/${numeroLimpo}?text=${encodeURIComponent(`Olá ${cliente.nome}, sou o Thiago da thIAguinho Soluções. Vi que você conversou com o nosso Mascote Arquiteto e ele desenhou um projeto tecnológico perfeito para a ${cliente.empresa}. Podemos conversar?`)}" target="_blank" class="w-10 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center transition" title="Enviar Proposta">
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

    // --- FUNÇÃO PARA EXCLUIR PROJETO DO BANCO ---
    window.excluirProjeto = function(idProjeto) {
        if (confirm("Tem certeza que deseja excluir este projeto definitivamente?")) {
            set(ref(database, `projetos_capturados/${idProjeto}`), null)
                .catch((error) => alert("Erro ao excluir o projeto: " + error.message));
        }
    };

    // --- LÓGICA DA JANELA DE USABILIDADE (MODAL) ---
    window.abrirModalProjeto = function(index) {
        const c = listaDeClientesGlobais[index];
        if(!c) return;

        document.getElementById('modal-nome').innerText = c.nome;
        document.getElementById('modal-empresa').innerText = c.empresa;
        document.getElementById('modal-dores').innerText = c.dores;
        
        // ESTRUTURA PROFISSIONAL DO FACILITÓIDE (Formatação Markdown -> HTML)
        let formataFacilitoide = c.facilitoide ? c.facilitoide.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong class="text-emerald-400">$1</strong>') : "<i>A IA não gerou uma arquitetura específica para este caso.</i>";
        document.getElementById('modal-facilitoide').innerHTML = formataFacilitoide;
        
        let numeroLimpoModal = c.whatsapp ? c.whatsapp.replace(/\D/g, '') : '';
        if (numeroLimpoModal.length >= 10 && numeroLimpoModal.length <= 11) {
            numeroLimpoModal = '55' + numeroLimpoModal;
        } else if (!numeroLimpoModal.startsWith('55') && numeroLimpoModal.length >= 12) {
             numeroLimpoModal = '55' + numeroLimpoModal;
        }

        const msgWhats = encodeURIComponent(`Olá ${c.nome}, sou o Thiago da thIAguinho Soluções. O nosso Arquiteto IA construiu um projeto exclusivo para a dor da ${c.empresa}. Vamos agendar uma reunião para fechar este negócio?`);
        document.getElementById('modal-whatsapp').href = `https://wa.me/${numeroLimpoModal}?text=${msgWhats}`;

        if(modalProjeto) modalProjeto.classList.remove('oculto');
    };

    const fecharModal = () => {
        if(modalProjeto) modalProjeto.classList.add('oculto');
    };
    
    if(btnFecharModal) btnFecharModal.addEventListener('click', fecharModal);
    if(btnFecharModal2) btnFecharModal2.addEventListener('click', fecharModal);
});