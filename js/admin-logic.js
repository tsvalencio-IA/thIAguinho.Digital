// NOME DO ARQUIVO: admin-logic.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { auth, database, signInWithEmailAndPassword, signOut, ref, set, onValue, get } from './firebase-config.js';
import { atualizarPromptMemoria, systemPrompt as promptPadrao } from './gemini-api.js';

document.addEventListener('DOMContentLoaded', () => {
    
    const btnLogin = document.getElementById('btn-login');
    const erroMsg = document.getElementById('msg-erro-login');
    const apiKeyInput = document.getElementById('api-key-input');
    const gridLeads = document.getElementById('grid-leads');
    
    let usuarioLogado = null;
    let listaProjetos = [];

    // --- LÓGICA DE LOGIN ---
    btnLogin.addEventListener('click', () => {
        const email = document.getElementById('email-admin').value;
        const senha = document.getElementById('senha-admin').value;
        
        if (!email || !senha) {
            erroMsg.innerText = "Preencha o e-mail e a senha.";
            erroMsg.classList.remove('oculto');
            return;
        }

        btnLogin.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Acessando...";
        
        signInWithEmailAndPassword(auth, email, senha)
            .then((user) => {
                usuarioLogado = user.user;
                document.getElementById('admin-login').classList.add('oculto');
                document.getElementById('admin-dashboard').classList.remove('oculto');
                iniciarCRM();
            })
            .catch((err) => {
                erroMsg.innerText = "Acesso Negado. Verifique no Firebase.";
                erroMsg.classList.remove('oculto');
                btnLogin.innerHTML = "Entrar no Painel";
            });
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        signOut(auth).then(() => window.location.reload());
    });

    // --- SALVAR A CHAVE API NO FIREBASE ---
    document.getElementById('btn-save-key').addEventListener('click', () => {
        const chave = apiKeyInput.value.trim();
        if(!chave) return alert("Por favor, cole a chave da API do Gemini.");
        
        const btn = document.getElementById('btn-save-key');
        btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i>";
        
        set(ref(database, 'admin_config/gemini_api_key'), chave)
            .then(() => {
                btn.innerHTML = "Salvo!";
                setTimeout(() => btn.innerHTML = "Salvar", 2000);
            });
    });

    // --- SALVAR PROMPT (O CÉREBRO DA IA) ---
    document.getElementById('btn-save-prompt').addEventListener('click', () => {
        const novoPrompt = document.getElementById('prompt-ia').value;
        const btn = document.getElementById('btn-save-prompt');
        const txtOriginal = btn.innerHTML;
        btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Salvando...";

        set(ref(database, 'admin_config/prompt_mascote'), novoPrompt)
            .then(() => {
                atualizarPromptMemoria(novoPrompt);
                btn.innerHTML = "Cérebro Atualizado!";
                setTimeout(() => btn.innerHTML = txtOriginal, 2000);
            });
    });

    // --- CARREGAR DADOS DO CRM ---
    function iniciarCRM() {
        // Carrega Chave da API na interface
        get(ref(database, 'admin_config/gemini_api_key')).then((snap) => {
            if(snap.exists()) apiKeyInput.value = snap.val();
        });

        // Carrega Prompt do Arquiteto
        get(ref(database, 'admin_config/prompt_mascote')).then((snap) => {
            const caixaTexto = document.getElementById('prompt-ia');
            if (snap.exists()) {
                caixaTexto.value = snap.val();
                atualizarPromptMemoria(snap.val());
            } else {
                caixaTexto.value = promptPadrao;
            }
        });

        // Escuta os Projetos Criados (Facilitóides) em Tempo Real
        onValue(ref(database, 'projetos_capturados'), (snapshot) => {
            gridLeads.innerHTML = ''; 
            
            if (!snapshot.exists()) {
                gridLeads.innerHTML = '<div class="col-span-full text-center py-10 text-slate-500"><p>Nenhum Facilitóide desenhado ainda.</p></div>';
                return;
            }

            listaProjetos = [];
            snapshot.forEach((child) => listaProjetos.push({ id: child.key, ...child.val() }));
            
            // Ordena do mais recente para o mais antigo
            listaProjetos.sort((a, b) => new Date(b.data) - new Date(a.data));

            listaProjetos.forEach((proj, i) => {
                const dataStr = new Date(proj.data).toLocaleDateString('pt-BR');
                
                // CORREÇÃO DO WHATSAPP (Evita duplicação do 55)
                let wppNum = proj.whatsapp ? proj.whatsapp.replace(/\D/g, '') : '';
                if (wppNum && !wppNum.startsWith('55')) {
                    wppNum = '55' + wppNum; // Adiciona o DDI brasileiro apenas se não existir
                }
                
                const card = document.createElement('div');
                card.className = "bg-slate-900 border border-slate-700 rounded-xl p-5 hover:border-red-500 transition shadow-lg flex flex-col justify-between";
                card.innerHTML = `
                    <div>
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <h4 class="font-bold text-white text-lg">${proj.nome}</h4>
                                <p class="text-xs text-slate-400 font-semibold uppercase">${proj.empresa}</p>
                            </div>
                            <span class="text-[10px] text-slate-500 bg-slate-800 px-2 py-1 rounded">${dataStr}</span>
                        </div>
                        <p class="text-sm text-slate-300 line-clamp-2 mb-4 italic">"${proj.dores}"</p>
                    </div>
                    <div class="border-t border-slate-700 pt-4 mt-auto flex gap-2">
                        <button onclick="window.verProjeto(${i})" class="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold py-2 rounded-lg border border-slate-600">Ver Sistema</button>
                        <a href="https://wa.me/${wppNum}?text=Olá ${proj.nome}, sou o Thiago da thIAguinho Soluções. Nossa Inteligência Artificial estruturou um modelo de sistema perfeito para as necessidades da ${proj.empresa}. Podemos conversar para eu te mostrar como vai funcionar?" target="_blank" class="w-10 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center" title="Iniciar Venda no WhatsApp">
                            <i class='bx bxl-whatsapp text-lg'></i>
                        </a>
                    </div>
                `;
                gridLeads.appendChild(card);
            });
        });
    }

    // --- GESTÃO DO MODAL DE APROVAÇÃO (USABILIDADE) ---
    window.verProjeto = function(i) {
        const p = listaProjetos[i];
        document.getElementById('modal-nome').innerText = p.nome;
        document.getElementById('modal-empresa').innerText = p.empresa;
        document.getElementById('modal-dores').innerText = p.dores;
        
        // Formata o Facilitóide mantendo os negritos gerados pela IA e quebras de linha
        let facilitoideFormatado = p.facilitoide || "Sem modelo técnico gerado pela IA.";
        facilitoideFormatado = facilitoideFormatado.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        document.getElementById('modal-facilitoide').innerHTML = facilitoideFormatado;
        
        // CORREÇÃO DO WHATSAPP NO MODAL
        let wppNum = p.whatsapp ? p.whatsapp.replace(/\D/g, '') : '';
        if (wppNum && !wppNum.startsWith('55')) {
            wppNum = '55' + wppNum;
        }
        
        const msgTexto = encodeURIComponent(`Olá ${p.nome}, sou o Thiago da thIAguinho Soluções. O nosso Arquiteto IA construiu o modelo de um sistema exclusivo para resolver o problema da ${p.empresa}. Vamos agendar uma reunião de apresentação?`);
        document.getElementById('modal-whatsapp').href = `https://wa.me/${wppNum}?text=${msgTexto}`;

        document.getElementById('modal-projeto').classList.remove('oculto');
    };

    const fecharModal = () => document.getElementById('modal-projeto').classList.add('oculto');
    document.getElementById('btn-fechar-modal').addEventListener('click', fecharModal);
    document.getElementById('btn-fechar-modal-2').addEventListener('click', fecharModal);
});
