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
    
    let usuarioLogado = null;

    btnLogin.addEventListener('click', () => {
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
            });
    });

    btnLogout.addEventListener('click', () => {
        signOut(auth).then(() => {
            usuarioLogado = null;
            document.getElementById('admin-dashboard').classList.add('oculto');
            document.getElementById('admin-login').classList.remove('oculto');
            emailInput.value = '';
            senhaInput.value = '';
        });
    });

    btnSavePrompt.addEventListener('click', () => {
        if (!usuarioLogado) return;
        
        const novoPrompt = document.getElementById('prompt-ia').value;
        const promptRef = ref(database, 'configuracoes/prompt_mascote');
        
        set(promptRef, novoPrompt)
            .then(() => {
                atualizarPromptMemoria(novoPrompt);
                alert("Sucesso! As regras do Mascote foram atualizadas em tempo real.");
            })
            .catch((error) => alert("Erro ao salvar no Firebase: " + error.message));
    });

    function iniciarLeituraDoBancoDeDados() {
        
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

        onValue(ref(database, 'leads'), (snapshot) => {
            const tbody = document.getElementById('tabela-leads');
            tbody.innerHTML = ''; 
            
            if (!snapshot.exists()) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-slate-500 py-8">Nenhum diagnóstico feito pelo Mascote ainda.</td></tr>';
                return;
            }

            const clientes = [];
            snapshot.forEach((filho) => clientes.push(filho.val()));
            
            clientes.sort((a, b) => new Date(b.data) - new Date(a.data));

            clientes.forEach(cliente => {
                const dataFormatada = new Date(cliente.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                
                tbody.innerHTML += `
                    <tr class="hover:bg-slate-700 border-b border-slate-700 transition">
                        <td class="p-4"><strong class="text-white text-base">${cliente.nome}</strong><br><span class="text-xs text-slate-400">${cliente.empresa}</span></td>
                        <td class="p-4 text-red-300 text-sm leading-relaxed">${cliente.dores}</td>
                        <td class="p-4 text-emerald-400 font-bold text-sm bg-slate-900 rounded-lg shadow-inner">${cliente.solucao}</td>
                        <td class="p-4 font-mono font-bold text-white text-base">${cliente.whatsapp}</td>
                        <td class="p-4 text-slate-400 text-xs">${dataFormatada}</td>
                    </tr>
                `;
            });
        });
    }
});