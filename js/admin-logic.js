// NOME DO FICHEIRO: admin-logic.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { auth, database, signInWithEmailAndPassword, signOut, ref, set, onValue, get } from './firebase-config.js';
import { atualizarPromptMemoria, systemPrompt as promptPadraoDaAPI } from './gemini-api.js';

document.addEventListener('DOMContentLoaded', () => {
    
    const emailInput = document.getElementById('email-admin');
    const senhaInput = document.getElementById('senha-admin');
    const btnLogin = document.getElementById('btn-login');
    const erroMsg = document.getElementById('msg-erro-login');
    
    const btnSavePrompt = document.getElementById('btn-save-prompt');
    const btnSaveKey = document.getElementById('btn-save-key');
    const apiKeyInput = document.getElementById('api-key-input');
    const gridLeads = document.getElementById('grid-leads');
    
    let usuarioLogado = null;
    let listaDeClientes = [];

    // --- LÓGICA DE LOGIN ---
    btnLogin.addEventListener('click', () => {
        if (!emailInput.value || !senhaInput.value) {
            erroMsg.innerText = "Por favor, preencha o email e a palavra-passe.";
            erroMsg.classList.remove('oculto');
            return;
        }

        const textoOriginal = btnLogin.innerHTML;
        btnLogin.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> A verificar no Firebase...";
        btnLogin.disabled = true;
        
        signInWithEmailAndPassword(auth, emailInput.value, senhaInput.value)
            .then((userCredential) => {
                usuarioLogado = userCredential.user;
                erroMsg.classList.add('oculto');
                document.getElementById('admin-login').classList.add('oculto');
                document.getElementById('admin-dashboard').classList.remove('oculto');
                
                iniciarLeituraDoBanco();
            })
            .catch((error) => {
                console.error("Falha no Login:", error.code);
                erroMsg.innerText = "Email ou palavra-passe incorretos.";
                erroMsg.classList.remove('oculto');
            })
            .finally(() => {
                btnLogin.innerHTML = textoOriginal;
                btnLogin.disabled = false;
            });
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.reload(); 
        });
    });

    // --- GUARDAR A CHAVE DA API DA INTELIGÊNCIA ARTIFICIAL ---
    btnSaveKey.addEventListener('click', () => {
        if (!usuarioLogado) return;
        const novaChave = apiKeyInput.value.trim();
        if(!novaChave) return alert("Por favor, cole a chave da API do Gemini no campo.");
        
        const btn = btnSaveKey;
        btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i>";
        
        // Guarda a chave no Firebase Realtime Database
        set(ref(database, 'configuracoes/gemini_api_key'), novaChave)
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

    // --- GUARDAR A LÓGICA DO ARQUITETO (CÉREBRO) ---
    btnSavePrompt.addEventListener('click', () => {
        if (!usuarioLogado) return;
        const btn = btnSavePrompt;
        const originalText = btn.innerHTML;
        btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> A guardar...";
        
        const novoPrompt = document.getElementById('prompt-ia').value;
        set(ref(database, 'configuracoes/prompt_mascote'), novoPrompt)
            .then(() => {
                atualizarPromptMemoria(novoPrompt);
                btn.innerHTML = "<i class='bx bx-check'></i> Guardado com sucesso!";
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

    // --- LER DADOS DO BACKEND ---
    function iniciarLeituraDoBanco() {
        
        // 1. Carrega a Chave API se já existir na base de dados
        get(ref(database, 'configuracoes/gemini_api_key')).then((snapshot) => {
            if(snapshot.exists()) {
                apiKeyInput.value = snapshot.val();
            }
        });

        // 2. Carrega o Comportamento da IA
        get(ref(database, 'configuracoes/prompt_mascote')).then((snapshot) => {
            const caixaTexto = document.getElementById('prompt-ia');
            if (snapshot.exists()) {
                const promptSalvo = snapshot.val();
                caixaTexto.value = promptSalvo;
                atualizarPromptMemoria(promptSalvo);
            } else {
                caixaTexto.value = promptPadraoDaAPI;
            }
        });

        // 3. Escuta os Projetos Criados (CRM)
        onValue(ref(database, 'leads'), (snapshot) => {
            gridLeads.innerHTML = ''; 
            
            if (!snapshot.exists()) {
                gridLeads.innerHTML = '<div class="col-span-full text-center py-10 text-slate-500"><p>Nenhum Facilitóide desenhado ainda. Partilhe o seu cartão com os clientes!</p></div>';
                return;
            }

            listaDeClientes = [];
            snapshot.forEach((filho) => {
                listaDeClientes.push({ id: filho.key, ...filho.val() });
            });
            
            listaDeClientes.sort((a, b) => new Date(b.data) - new Date(a.data));

            listaDeClientes.forEach((cliente, index) => {
                const dataStr = new Date(cliente.data).toLocaleDateString('pt-PT');
                const btnWhats = cliente.whatsapp ? cliente.whatsapp.replace(/\D/g, '') : '';
                
                const card = document.createElement('div');
                card.className = "bg-slate-900 border border-slate-700 rounded-xl p-5 hover:border-red-500 transition shadow-lg flex flex-col justify-between";
                card.innerHTML = `
                    <div>
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <h4 class="font-bold text-white text-lg leading-tight">${cliente.nome}</h4>
                                <p class="text-xs text-slate-400 font-semibold uppercase tracking-wider">${cliente.empresa}</p>
                            </div>
                            <span class="text-[10px] text-slate-500 bg-slate-800 px-2 py-1 rounded">${dataStr}</span>
                        </div>
                        <p class="text-sm text-slate-300 line-clamp-2 mb-4 italic">"${cliente.dores}"</p>
                    </div>
                    
                    <div class="border-t border-slate-700 pt-4 mt-auto flex gap-2">
                        <button onclick="window.abrirProjeto(${index})" class="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold py-2 rounded-lg transition border border-slate-600 flex items-center justify-center gap-2">
                            <i class='bx bx-search-alt-2'></i> Ver Sistema
                        </button>
                        <a href="https://wa.me/55${btnWhats}?text=Olá ${cliente.nome}, sou o Thiago da thIAguinho Soluções. Vi que conversou com o nosso arquiteto IA e ele desenhou um Facilitóide para a ${cliente.empresa}. Podemos conversar?" target="_blank" class="w-10 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center transition">
                            <i class='bx bxl-whatsapp text-lg'></i>
                        </a>
                    </div>
                `;
                gridLeads.appendChild(card);
            });
        });
    }

    // --- LÓGICA DA JANELA DE USABILIDADE (MODAL) ---
    window.abrirProjeto = function(index) {
        const c = listaDeClientes[index];
        if(!c) return;

        document.getElementById('modal-nome').innerText = c.nome;
        document.getElementById('modal-empresa').innerText = c.empresa;
        document.getElementById('modal-dores').innerText = c.dores;
        
        document.getElementById('modal-facilitoide').innerHTML = c.facilitoide ? c.facilitoide.replace(/\n/g, '<br>') : "<i>Nenhum sistema específico desenhado.</i>";
        
        const whatsLimpo = c.whatsapp ? c.whatsapp.replace(/\D/g, '') : '';
        const msgWhats = encodeURIComponent(`Olá ${c.nome}, sou o Thiago da thIAguinho Soluções. O nosso Arquiteto IA construiu um projeto exclusivo para a dor da ${c.empresa}. Vamos agendar uma reunião para fechar este negócio?`);
        document.getElementById('modal-whatsapp').href = `https://wa.me/55${whatsLimpo}?text=${msgWhats}`;

        document.getElementById('modal-projeto').classList.remove('oculto');
    };

    const fecharModal = () => document.getElementById('modal-projeto').classList.add('oculto');
    document.getElementById('btn-fechar-modal').addEventListener('click', fecharModal);
    document.getElementById('btn-fechar-modal-2').addEventListener('click', fecharModal);
});