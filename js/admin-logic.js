// CRIE ESTE ARQUIVO DENTRO DA PASTA js COM O NOME admin-logic.js
import { auth, database, signInWithEmailAndPassword, signOut, ref, set, onValue, get } from './firebase-config.js';
import { atualizarPromptMemoria, systemPrompt as promptPadraoDaAPI } from './gemini-api.js';

document.addEventListener('DOMContentLoaded', () => {
    
    const emailInput = document.getElementById('email-admin');
    const senhaInput = document.getElementById('senha-admin');
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const erroMsg = document.getElementById('msg-erro-login');
    const btnSavePrompt = document.getElementById('btn-save-prompt');
    const gridLeads = document.getElementById('grid-leads');
    
    // Elementos do Modal
    const modalProjeto = document.getElementById('modal-projeto');
    const btnFecharModal = document.getElementById('btn-fechar-modal');
    const btnFecharModal2 = document.getElementById('btn-fechar-modal-2');
    
    let usuarioLogado = null;
    let listaDeClientesGlobais = [];

    // --- AUTENTICAÇÃO ---
    btnLogin.addEventListener('click', () => {
        const btnTexto = btnLogin.innerHTML;
        btnLogin.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Conectando...";
        
        signInWithEmailAndPassword(auth, emailInput.value, senhaInput.value)
            .then((userCredential) => {
                usuarioLogado = userCredential.user;
                erroMsg.classList.add('oculto');
                document.getElementById('admin-login').classList.add('oculto');
                document.getElementById('admin-dashboard').classList.remove('oculto');
                iniciarLeituraDoBancoDeDados();
            })
            .catch((error) => {
                console.error("Erro Auth Firebase:", error);
                erroMsg.classList.remove('oculto');
                btnLogin.innerHTML = "Entrar no Painel";
            });
    });

    btnLogout.addEventListener('click', () => {
        signOut(auth).then(() => {
            usuarioLogado = null;
            document.getElementById('admin-dashboard').classList.add('oculto');
            document.getElementById('admin-login').classList.remove('oculto');
            emailInput.value = '';
            senhaInput.value = '';
            btnLogin.innerHTML = "Entrar no Painel";
        });
    });

    // --- SALVAR CÉREBRO DA IA ---
    btnSavePrompt.addEventListener('click', () => {
        if (!usuarioLogado) return;
        const btn = btnSavePrompt;
        const originalText = btn.innerHTML;
        btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Salvando...";
        
        const novoPrompt = document.getElementById('prompt-ia').value;
        set(ref(database, 'configuracoes/prompt_mascote'), novoPrompt)
            .then(() => {
                atualizarPromptMemoria(novoPrompt);
                btn.innerHTML = "<i class='bx bx-check'></i> Salvo!";
                btn.classList.replace('bg-red-600', 'bg-emerald-600');
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.classList.replace('bg-emerald-600', 'bg-red-600');
                }, 2000);
            })
            .catch((error) => {
                alert("Erro ao salvar no Firebase: " + error.message);
                btn.innerHTML = originalText;
            });
    });

    // --- LER BANCO DE DADOS (USABILIDADE DE CARDS) ---
    function iniciarLeituraDoBancoDeDados() {
        
        // 1. Carrega o Cérebro
        get(ref(database, 'configuracoes/prompt_mascote')).then((snapshot) => {
            const caixaTexto = document.getElementById('prompt-ia');
            if (snapshot.exists()) {
                const promptSalvoNoFirebase = snapshot.val();
                caixaTexto.value = promptSalvoNoFirebase;
                atualizarPromptMemoria(promptSalvoNoFirebase);
            } else {
                caixaTexto.value = promptPadraoDaAPI;
            }
        });

        // 2. Escuta os Clientes (Leads e Facilitóides)
        onValue(ref(database, 'leads'), (snapshot) => {
            gridLeads.innerHTML = ''; 
            
            if (!snapshot.exists()) {
                gridLeads.innerHTML = '<div class="col-span-full text-center py-10 text-slate-500"><i class="bx bx-sleepy text-4xl mb-3"></i><p>Nenhum projeto desenhado ainda. Mande clientes escanear o QRCode!</p></div>';
                return;
            }

            listaDeClientesGlobais = [];
            snapshot.forEach((filho) => {
                listaDeClientesGlobais.push({ id: filho.key, ...filho.val() });
            });
            
            // Ordem decrescente (mais recentes primeiro)
            listaDeClientesGlobais.sort((a, b) => new Date(b.data) - new Date(a.data));

            // Gera os Cartões de Usabilidade
            listaDeClientesGlobais.forEach((cliente, index) => {
                const dataFormatada = new Date(cliente.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                
                // Limpa o número do whatsapp para o link
                const numeroLimpo = cliente.whatsapp.replace(/\D/g, '');
                
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
                            <i class='bx bx-search-alt-2'></i> Ver Projeto
                        </button>
                        <a href="https://wa.me/55${numeroLimpo}?text=Olá ${cliente.nome}, sou o Thiago da thIAguinho Soluções. Vi que conversou com nossa IA e ela montou um projeto de Automação/Sistema para a ${cliente.empresa}. Podemos conversar?" target="_blank" class="w-10 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center transition" title="Mandar WhatsApp">
                            <i class='bx bxl-whatsapp text-lg'></i>
                        </a>
                    </div>
                `;
                gridLeads.appendChild(card);
            });
        });
    }

    // --- LÓGICA DO MODAL ---
    window.abrirModalProjeto = function(index) {
        const cliente = listaDeClientesGlobais[index];
        if(!cliente) return;

        document.getElementById('modal-nome').innerText = cliente.nome;
        document.getElementById('modal-empresa').innerText = cliente.empresa;
        document.getElementById('modal-dores').innerText = cliente.dores;
        
        // A mágica: Mostrar o facilitóide gerado
        document.getElementById('modal-facilitoide').innerHTML = cliente.facilitoide ? cliente.facilitoide.replace(/\n/g, '<br>') : "<i>Nenhum facilitóide específico extraído.</i>";
        
        const numLimpo = cliente.whatsapp.replace(/\D/g, '');
        const txtWhats = encodeURIComponent(`Olá ${cliente.nome}, sou o Thiago da thIAguinho Soluções. Nossa IA estruturou um Facilitóide incrível para a ${cliente.empresa} para resolver a dor de: ${cliente.dores}. Podemos falar sobre o orçamento?`);
        document.getElementById('modal-whatsapp').href = `https://wa.me/55${numLimpo}?text=${txtWhats}`;

        modalProjeto.classList.remove('oculto');
    };

    const fecharModal = () => modalProjeto.classList.add('oculto');
    btnFecharModal.addEventListener('click', fecharModal);
    btnFecharModal2.addEventListener('click', fecharModal);
});