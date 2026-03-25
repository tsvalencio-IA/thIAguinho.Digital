// NOME DO ARQUIVO: gemini-api.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { database, ref, push, set, get } from './firebase-config.js';

let chatHistoryCliente = [];
let chaveApiArmazenada = null; 

// =========================================================================
// CÉREBRO 1: A VENDEDORA E ARQUITETA
// =========================================================================
export let systemPrompt = `Você é a IA central da 'thIAguinho Soluções Digitais'. Você tem 2 funções invisíveis para o cliente: Vendedora Empática e Arquiteta Sênior.

REGRA DE OURO DOS BOTÕES:
Gere SEMPRE opções de clique com o TEXTO COMPLETO. NUNCA use letras isoladas como "A", "B" ou "C".
Formato OBRIGATÓRIO: [OPCOES: Texto completo da primeira opção | Texto completo da segunda opção]

PASSO 1: Cumprimente e pergunte se busca soluções para Empresa ou Rotina Pessoal.
PASSO 2: Investigue PROFUNDAMENTE a dor principal.
PASSO 3: Quando descobrir "A Verdade" (a dor real), diga: "Vou desenhar o modelo técnico." e PEÇA O WHATSAPP COM DDD (Ex: 11999999999).
PASSO 4: SÓ DEPOIS de receber o WhatsApp, agradeça e gere a tag abaixo.

FORMATO OBRIGATÓRIO DA TAG FINAL (ESCUDO TÉCNICO):
[LEAD: NOME=... | EMPRESA=... | DORES=... | FACILITOIDE=... | WHATSAPP=...]

COMO PREENCHER "FACILITOIDE":
Use a sua mente de Arquiteta Sênior. Estruture em Markdown.
**Projeto:** [Nome do Sistema]
**Lógica:** [Como funciona]
**Stack Técnico:** [Ex: GitHub Pages, Cloudinary, Firebase Realtime Database].`;

export function atualizarPromptMemoria(novoPrompt) {
    if (novoPrompt && novoPrompt.trim() !== '') {
        systemPrompt = novoPrompt;
    }
}

async function obterChaveDaApi() {
    if (chaveApiArmazenada) return chaveApiArmazenada;
    try {
        const snapshot = await get(ref(database, 'admin_config/gemini_api_key'));
        if (snapshot.exists()) {
            chaveApiArmazenada = snapshot.val();
            return chaveApiArmazenada;
        }
    } catch (e) { console.error("Erro Firebase:", e); }
    return null;
}

export async function askGemini(msgUsuario) {
    try {
        const apiKey = await obterChaveDaApi();
        if (!apiKey) return "Aviso: Chave da API não configurada.";

        const MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const contents = chatHistoryCliente.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
        contents.push({ role: 'user', parts: [{ text: msgUsuario }] });

        const res = await fetch(MODEL_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: contents, systemInstruction: { parts: [{ text: systemPrompt }] } })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        
        let botReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro.";
        
        const regexLead = /\[LEAD:\s*NOME=([\s\S]*?)\|\s*EMPRESA=([\s\S]*?)\|\s*DORES=([\s\S]*?)\|\s*FACILITOIDE=([\s\S]*?)\|\s*WHATSAPP=([\s\S]*?)\]/i;
        const match = botReply.match(regexLead);
        
        if (match) {
            const [, nome, empresa, dores, facilitoide, whatsapp] = match;
            let wppLimpo = whatsapp.replace(/\D/g, '');
            if (wppLimpo.startsWith('55') && wppLimpo.length > 11) wppLimpo = wppLimpo.substring(2); 

            const novoLeadRef = push(ref(database, 'projetos_capturados'));
            set(novoLeadRef, {
                nome: nome.trim() || "Não informado", empresa: empresa.trim() || "Não informada",
                dores: dores.trim(), facilitoide: facilitoide.trim(), whatsapp: wppLimpo, data: new Date().toISOString(), devChat: []
            });
            botReply = botReply.replace(regexLead, '').trim();
        }
        return botReply;
    } catch(e) { return "Erro no servidor neural. Pode repetir?"; }
}

export function adicionarAoHistorico(role, texto) {
    chatHistoryCliente.push({ role: role, text: texto });
}

// =========================================================================
// CÉREBRO 2: O DESENVOLVEDOR DA FÁBRICA (AGORA COM BLINDAGEM DE 5 CLIQUES)
// =========================================================================
export async function conversarComDesenvolvedorIA(msgAdmin, contextoProjeto, historicoSalvo = []) {
    try {
        const apiKey = await obterChaveDaApi();
        if (!apiKey) return "Coloque a chave da API nas configurações do Painel.";

        const promptDesenvolvedor = `Você é um Engenheiro de Software Sênior trabalhando para o Thiago (Dono da Agência thIAguinho Soluções).
        Projeto atual: ${contextoProjeto}
        
        DIRETRIZ MÁXIMA PARA DEMONSTRAÇÕES DE CLIENTES:
        Toda vez que você for escrever um arquivo HTML que contenha o código de um sistema/app para o cliente testar, você DEVE OBRIGATORIAMENTE injetar um script de bloqueio (Trial) de 5 cliques.
        
        LÓGICA DO SCRIPT DE BLOQUEIO QUE VOCÊ DEVE INSERIR NO HTML GERADO:
        1. Crie uma variável no localStorage ('thIAguinho_trial_clicks').
        2. Adicione um eventListener no 'document' que escute qualquer 'click'.
        3. Se o número de cliques chegar a 5, injete no body uma div que cubra a tela toda (position fixed, inset-0, z-index 9999, fundo preto).
        4. O texto da div deve ser: "Atenção: A sua versão de demonstração expirou. Entre em contato com a thIAguinho Soluções para adquirir o sistema completo."
        5. Esta div não deve ter botão de fechar.
        
        REGRA DE COMUNICAÇÃO COM O THIAGO:
        Comece sempre dizendo: "Thiago, aqui está o código com o sistema de bloqueio ativado."
        Depois, envie OBRIGATORIAMENTE os blocos de código formatados em Markdown (\`\`\`html, \`\`\`javascript).`;

        const MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const contents = historicoSalvo.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
        contents.push({ role: 'user', parts: [{ text: msgAdmin }] });

        const res = await fetch(MODEL_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: contents, systemInstruction: { parts: [{ text: promptDesenvolvedor }] } })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro de processamento.";

    } catch(e) {
        return "Erro de compilação na IA: " + e.message;
    }
}