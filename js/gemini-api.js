// NOME DO ARQUIVO: gemini-api.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { database, ref, push, set, get } from './firebase-config.js';

let chatHistoryCliente = [];
let chaveApiArmazenada = null; 

// =========================================================================
// CÉREBRO 1: A VENDEDORA E ARQUITETA (BLINDADA)
// =========================================================================
export let systemPrompt = `Você é o Mascote Arquiteto da 'thIAguinho Soluções'. Sua missão é entrevistar o cliente de forma amigável, natural e altamente conversacional.

REGRAS ESTritas DE CONDUTA (NUNCA QUEBRE):
1. FAÇA APENAS UMA PERGUNTA POR VEZ. Nunca envie uma lista de perguntas ou jogue um questionário inteiro na cara do cliente.
2. NUNCA, SOB NENHUMA HIPÓTESE, mostre as palavras "LEAD", "FACILITOIDE" ou qualquer formato de tag para o cliente.
3. SEMPRE gere botões de resposta no formato OBRIGATÓRIO: [OPCOES: Texto 1 | Texto 2]. Nunca use "Opção A" ou "Opção B".

FLUXO DA CONVERSA (Siga os Passos):
PASSO 1: Cumprimente. Pergunte o nome do cliente e se ele busca soluções para a Empresa ou para a Rotina Pessoal.
PASSO 2: Investigue qual a maior DOR ou problema que ele quer resolver. (Ex: O que mais toma seu tempo hoje?).
PASSO 3: Quando entender a dor, diga: "Vou desenhar a arquitetura técnica ideal para você. Por favor, digite seu WhatsApp com DDD."
PASSO 4: QUANDO O CLIENTE FORNECER O WHATSAPP, você deve agradecer e encerrar a conversa. 

O SEGREDO DA TAG (GERAR APENAS NO PASSO 4):
Na sua ÚLTIMA mensagem (e somente nela), você deve gerar a tag abaixo NO FINAL do seu texto. O sistema vai apagar isso antes do cliente ler, então preencha com o que você descobriu:
[LEAD: NOME=nome do cliente | EMPRESA=tipo de negócio | DORES=resumo da dor | FACILITOIDE=sua sugestão de sistema em markdown | WHATSAPP=apenas numeros]`;

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
        
        let botReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro interno da IA.";
        
        // O CÓDIGO CAÇADOR: Procura a Tag na mensagem e tira ela antes de mostrar pro cliente
        const regexLead = /\[LEAD:\s*NOME=([\s\S]*?)\|\s*EMPRESA=([\s\S]*?)\|\s*DORES=([\s\S]*?)\|\s*FACILITOIDE=([\s\S]*?)\|\s*WHATSAPP=([\s\S]*?)\]/i;
        const match = botReply.match(regexLead);
        
        if (match) {
            const [, nome, empresa, dores, facilitoide, whatsapp] = match;
            let wppLimpo = whatsapp.replace(/\D/g, '');
            if (wppLimpo.startsWith('55') && wppLimpo.length > 11) wppLimpo = wppLimpo.substring(2); 

            const novoLeadRef = push(ref(database, 'projetos_capturados'));
            set(novoLeadRef, {
                nome: nome.trim() || "Cliente Indefinido", 
                empresa: empresa.trim() || "Não informada",
                dores: dores.trim() || "Sem dor informada", 
                facilitoide: facilitoide.trim() || "Aguardando arquitetura.", 
                whatsapp: wppLimpo, 
                data: new Date().toISOString(), 
                devChat: [],
                status: 'novo'
            });
            
            // Apaga a Tag da mensagem visual
            botReply = botReply.replace(regexLead, '').trim();
        }
        return botReply;
    } catch(e) { return "Houve uma falha na minha rede neural. Poderia repetir?"; }
}

export function adicionarAoHistorico(role, texto) {
    chatHistoryCliente.push({ role: role, text: texto });
}

// =========================================================================
// CÉREBRO 2: O DESENVOLVEDOR DA FÁBRICA
// =========================================================================
export async function conversarComDesenvolvedorIA(msgAdmin, contextoProjeto, historicoSalvo = []) {
    try {
        const apiKey = await obterChaveDaApi();
        if (!apiKey) return "Coloque a chave da API nas configurações do Painel.";

        const promptDesenvolvedor = `Você é um Engenheiro de Software Sênior trabalhando para o Thiago (Dono da Agência thIAguinho Soluções).
        Projeto atual do cliente: ${contextoProjeto}
        
        REGRA MÁXIMA DE COMUNICAÇÃO:
        A tela do Thiago é limitada. SEMPRE siga esta ordem:
        1. Comece dizendo exatamente os nomes dos arquivos que gerou (Ex: "Thiago, estou enviando estes 2 arquivos: index.html e app.js").
        2. Entregue os blocos de código completos e formatados em Markdown (\`\`\`html, \`\`\`javascript).
        3. Se o Thiago enviar conteúdo de códigos base dele, adapte-os e evolua para este cliente específico.`;

        const MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const contents = historicoSalvo.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
        contents.push({ role: 'user', parts: [{ text: msgAdmin }] });

        const res = await fetch(MODEL_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: contents, systemInstruction: { parts: [{ text: promptDesenvolvedor }] } })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro de processamento da IA.";

    } catch(e) {
        return "Erro de compilação: " + e.message;
    }
}