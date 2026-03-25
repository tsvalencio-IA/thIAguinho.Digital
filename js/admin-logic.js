// NOME DO FICHEIRO: admin-logic.js
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

    btnLogin.addEventListener('click', () => {
        const email = document.getElementById('email-admin').value;
        const senha = document.getElementById('senha-admin').value;
        
        if (!email || !senha) {
            erroMsg.innerText = "Preencha o e-mail e a palavra-passe.";
            erroMsg.classList.remove('oculto');
            return;
        }

        btnLogin.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> A aceder...";
        
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

    // SALVAR A CHAVE API NO FIREBASE
    document.getElementById('btn-save-key').addEventListener('click', () => {
        const chave = apiKeyInput.value.trim();
        if(!chave) return alert("Por favor, cole a chave da API do Gemini no campo.");
        
        const btn = document.getElementById('btn-save-key');
        btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i>";
        
        set(ref(database, 'admin_config/gemini_api_key'), chave)
            .then(() => {
                btn.innerHTML = "Guardado!";
                setTimeout(() => btn.innerHTML = "Guardar", 2000);
            })
            .catch((error) => alert("Erro ao guardar chave: " + error.message));
    });

    // SALVAR PROMPT DO ARQUITETO
    document.getElementById('btn-save-prompt').addEventListener('click', () => {
        const novoPrompt = document.getElementById('prompt-ia').value;
        const btn = document.getElementById('btn-save-prompt');
        const txtOriginal = btn.innerHTML;
        btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> A guardar...";

        set(ref(database, 'admin_config/prompt_mascote'), novoPrompt)
            .then(() => {
                atualizarPromptMemoria(novoPrompt);
                btn.innerHTML = "Cérebro Atualizado!";
                setTimeout(() => btn.innerHTML = txtOriginal, 2000);
            });
    });

    function iniciarCRM() {
        // Carrega a Chave da base de dados para o campo de input
        get(ref(database, 'admin_config/gemini_api_key')).then((snap) => {
            if(snap.exists()) apiKeyInput.value = snap.val();
        });

        // Carrega o Prompt
        get(ref(database, 'admin_config/prompt_mascote')).then((snap) => {
            const caixaTexto = document.getElementById('prompt-ia');
            if (snap.exists()) {
                caixaTexto.value = snap.val();
                atualizarPromptMemoria(snap.val());
            } else {
                caixaTexto.value = promptPadrao;
            }
        });

        // Escuta os Facilitóides Gerados (Projetos)
        onValue(ref(database, 'projetos_capturados'), (snapshot) => {
            gridLeads.innerHTML = ''; 
            
            if (!snapshot.exists()) {
                gridLeads.innerHTML = '<div class="col-span-full text-center py-10 text-slate-500"><p>Nenhum Facilitóide desenhado ainda.</p></div>';
                return;
            }

            listaProjetos = [];
            snapshot.forEach((child) => listaProjetos.push({ id: child.key, ...child.val() }));
            listaProjetos.sort((a, b) => new Date(b.data) - new Date(a.data));

            listaProjetos.forEach((proj, i) => {
                const dataStr = new Date(proj.data).toLocaleDateString('pt-PT');
                const wppNum = proj.whatsapp.replace(/\D/g, '');
                
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
                        <a href="https://wa.me/55${wppNum}?text=Olá ${proj.nome}, sou o Thiago da thIAguinho Soluções. A nossa IA desenhou um projeto incrível para a sua empresa!" target="_blank" class="w-10 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center">
                            <i class='bx bxl-whatsapp text-lg'></i>
                        </a>
                    </div>
                `;
                gridLeads.appendChild(card);
            });
        });
    }

    // GESTÃO DA JANELA MODAL
    window.verProjeto = function(i) {
        const p = listaProjetos[i];
        document.getElementById('modal-nome').innerText = p.nome;
        document.getElementById('modal-empresa').innerText = p.empresa;
        document.getElementById('modal-dores').innerText = p.dores;
        document.getElementById('modal-facilitoide').innerHTML = p.facilitoide ? p.facilitoide.replace(/\n/g, '<br>') : "Sem dados do sistema.";
        
        const wppNum = p.whatsapp.replace(/\D/g, '');
        document.getElementById('modal-whatsapp').href = `https://wa.me/55${wppNum}?text=Olá ${p.nome}, aqui é da thIAguinho Soluções! Vi o projeto do seu Facilitóide. Vamos marcar uma reunião?`;

        document.getElementById('modal-projeto').classList.remove('oculto');
    };

    const fecharModal = () => document.getElementById('modal-projeto').classList.add('oculto');
    document.getElementById('btn-fechar-modal').addEventListener('click', fecharModal);
    document.getElementById('btn-fechar-modal-2').addEventListener('click', fecharModal);
});
