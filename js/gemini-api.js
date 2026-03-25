// NOME DO ARQUIVO: gemini-api.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { database, ref, push, set, get } from './firebase-config.js';

let chatHistory = [];
let chaveApiArmazenada = null; 

// =========================================================================
// O CÉREBRO: VENDEDOR PARA O CLIENTE E ENGENHEIRO PARA O ADMIN
// =========================================================================
export let systemPrompt = `Você é o Mascote Vendedor de Inteligência Artificial da 'thIAguinho Soluções Digitais'. Você tem DUAS funções simultâneas e rigorosas:
1. Para o CLIENTE (no chat): Você é um vendedor investigativo, empático e prático.
2. Para o ADMIN (na tag oculta): Você é um Engenheiro de Software Sênior que arquiteta Sistemas e Automações ("Facilitóides").

COMO AGIR COM O CLIENTE (FRONT-END):
- Faça uma investigação real e estratégica. Não faça todas as perguntas de uma vez.
- Passo 1: Comece perguntando Nome e Empresa. (Use opções curtas para a área se quiser).
- Passo 2: Investigue a dor real: "No seu dia a dia, qual processo é mais manual, repetitivo ou onde a sua equipe perde mais tempo e dinheiro hoje?"
- FACILITADOR VISUAL: Sempre facilite a resposta do cliente gerando botões no final da sua fala. Use EXATAMENTE este formato: [OPCOES: Opção 1 | Opção 2 | Opção 3]
- Passo 3: Quando identificar o gargalo real (faça-o falar a verdade), diga que a thIAguinho tem a tecnologia EXATA para automatizar isso e peça APENAS o número do WhatsApp com DDD para o Thiago (Engenheiro Chefe) enviar o modelo do projeto.

O SEGREDO DA ARQUITETURA (BACK-END PARA O ADMIN):
Assim que o cliente fornecer o WhatsApp, a sua função de Engenheiro Sênior entra em ação. Você DEVE criar o modelo PRONTO do "Facilitóide" (Sistema/Automação) para o Admin aprovar.
No FINAL ABSOLUTO da sua última mensagem de agradecimento, gere OBRIGATORIAMENTE a tag oculta abaixo:

[LEAD: NOME=... | EMPRESA=... | DORES=... | FACILITOIDE=... | WHATSAPP=...]

COMO PREENCHER A TAG (ESTRITAMENTE OBRIGATÓRIO):
- DORES: Resuma o problema real que você investigou.
- FACILITOIDE: Entregue o modelo do sistema pronto! Escreva um escopo técnico estruturado. Exemplo: "**Sistema:** CRM Inteligente. **Gatilho:** API do WhatsApp. **Ação:** O Bot (OpenAI) qualifica o lead e salva na planilha. **Objetivo:** Reduzir em 80% o tempo humano." (Adapte a solução técnica à dor relatada de forma realista).
- WHATSAPP: Apenas os números exatos do telefone, SEM o +55. (Ex: 17999999999).`;

export function atualizarPromptMemoria(novoPrompt) {
    if (novoPrompt && novoPrompt.trim() !== '') {
        systemPrompt = novoPrompt;
    }
}

// Busca a chave da API salva pelo Admin no Firebase
async function obterChaveDaApi() {
    if (chaveApiArmazenada) return chaveApiArmazenada;
    try {
        const snapshot = await get(ref(database, 'admin_config/gemini_api_key'));
        if (snapshot.exists()) {
            chaveApiArmazenada = snapshot.val();
            return chaveApiArmazenada;
        }
    } catch (e) {
        console.error("Erro ao buscar a chave no Firebase:", e);
    }
    return null;
}

export async function askGemini(msgUsuario) {
    try {
        // Tenta obter a chave do Firebase, caso não exista, alerta no console
        const apiKey = await obterChaveDaApi();
        if (!apiKey) {
            console.error("Aviso: Chave da API do Gemini não encontrada no Firebase.");
            return "Aviso do Sistema: O administrador da Agência ainda não configurou a chave da Inteligência Artificial no Painel.";
        }

        // Conexão com o endpoint exato do Gemini 2.5 Flash
        const MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const contents = chatHistory.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
        contents.push({ role: 'user', parts: [{ text: msgUsuario }] });

        const res = await fetch(MODEL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                systemInstruction: { parts: [{ text: systemPrompt }] }
            })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        
        let botReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Falha nos circuitos neurais.";
        
        // INTERCEPTAÇÃO E ARMAZENAMENTO NO FIREBASE
        // O regex [\s\S]*? garante que captamos o escopo do projeto mesmo que a IA use quebras de linha
        const regexLead = /\[LEAD:\s*NOME=([\s\S]*?)\|\s*EMPRESA=([\s\S]*?)\|\s*DORES=([\s\S]*?)\|\s*FACILITOIDE=([\s\S]*?)\|\s*WHATSAPP=([\s\S]*?)\]/i;
        const match = botReply.match(regexLead);
        
        if (match) {
            const [, nome, empresa, dores, facilitoide, whatsapp] = match;
            
            const novoLeadRef = push(ref(database, 'projetos_capturados'));
            set(novoLeadRef, {
                nome: nome.trim(),
                empresa: empresa.trim(),
                dores: dores.trim(),
                facilitoide: facilitoide.trim(), // O Modelo de Software Técnico gerado
                whatsapp: whatsapp.trim(),
                data: new Date().toISOString()
            });

            // Apaga a tag técnica da vista do cliente
            botReply = botReply.replace(regexLead, '').trim();
        }

        return botReply;

    } catch(e) {
        console.error("Erro Gemini:", e);
        return "Ops! Estou compilando o projeto na nuvem. Você pode repetir a última mensagem?";
    }
}

export function adicionarAoHistorico(role, texto) {
    chatHistory.push({ role: role, text: texto });
}
