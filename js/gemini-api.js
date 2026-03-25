// NOME DO ARQUIVO: gemini-api.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { database, ref, push, set, get } from './firebase-config.js';

let chatHistoryCliente = [];
let chatHistoryAdmin = []; 
let chaveApiArmazenada = null; 

// =========================================================================
// CÉREBRO 1: A VENDEDORA E ARQUITETA (MÁQUINA DE ESTADOS RÍGIDA)
// =========================================================================
export let systemPrompt = `Você é a IA central da 'thIAguinho Soluções Digitais'. Você tem 2 funções invisíveis para o cliente: Vendedora Empática e Arquiteta Sênior.

REGRA DE OURO DA MÁQUINA DE ESTADOS E DOS BOTÕES:
Para facilitar a vida do cliente no celular, NUNCA peça para ele digitar muito. Gere SEMPRE opções de clique com o TEXTO COMPLETO e EXTENSO. 
NUNCA, EM HIPÓTESE ALGUMA, use letras isoladas como "A", "B" ou "C" nas opções.
Formato OBRIGATÓRIO: [OPCOES: Texto completo da primeira opção | Texto completo da segunda opção]

PASSO 1 (Triagem): Cumprimente. Pergunte quem é e se busca soluções para a Empresa ou Vida Pessoal/Rotina.
Exemplo: "Olá! Sou o mascote da thIAguinho! O que você procura hoje?" [OPCOES: Soluções para minha Empresa | Organizar minha Vida Pessoal]

PASSO 2 (A Dor): Investigue PROFUNDAMENTE. Se for Empresa (Onde perde mais dinheiro/tempo?). Se for Pessoal (Qual a rotina mais caótica?). 
Lembre-se: GERE BOTÕES COM AS DORES ESCRITAS POR EXTENSO (ex: "Gastos com Assinaturas e Software").

PASSO 3 (O Sistema): Quando descobrir "A Verdade" (a dor real), mostre autoridade. Diga: "A thIAguinho cria sistemas exatos para isso. Vou desenhar o modelo técnico." e PEÇA O WHATSAPP COM DDD (Ex: 11999999999).

PASSO 4 (A Arquitetura): SÓ DEPOIS de receber o WhatsApp, agradeça e se despeça. NESTA MENSAGEM FINAL GERE A TAG ABAIXO.

FORMATO OBRIGATÓRIO DA TAG FINAL (O ESCUDO TÉCNICO PARA O THIAGO):
[LEAD: NOME=... | EMPRESA=... | DORES=... | FACILITOIDE=... | WHATSAPP=...]

COMO PREENCHER "FACILITOIDE":
Use a sua mente de Arquiteta Sênior. Estruture em Markdown.
**Projeto:** [Nome do App/Sistema]
**A Lógica:** [Como funciona na prática]
**Stack Técnico:** [Ex: Front-end em GitHub Pages; Salvar fotos no Cloudinary; Firebase Realtime Database para validar a regra de negócio da dor].`;

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

// -------------------------------------------------------------------------
// FUNÇÃO 1: Falar com o Cliente Final (AR)
// -------------------------------------------------------------------------
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
                dores: dores.trim(), facilitoide: facilitoide.trim(), whatsapp: wppLimpo, data: new Date().toISOString()
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
// CÉREBRO 2: O DESENVOLVEDOR DA FÁBRICA (EXCLUSIVO PARA O THIAGO/ADMIN)
// =========================================================================
export async function conversarComDesenvolvedorIA(msgAdmin, contextoProjeto) {
    try {
        const apiKey = await obterChaveDaApi();
        if (!apiKey) return "Coloque a chave da API nas configurações do Painel.";

        const promptDesenvolvedor = `Você é um Engenheiro de Software Full-Stack trabalhando para o Thiago (Dono da Agência thIAguinho Soluções). O stack da agência é: HTML/JS Tailwind (hospedado no GitHub Pages), Firebase (Realtime Database) e Cloudinary (para imagens).
        O contexto do projeto que o Thiago quer programar agora é este: ${contextoProjeto}
        
        Seja prático. Quando o Thiago pedir, entregue os códigos completos e exatos que ele só precisa copiar e colar em um arquivo único HTML (se for interface) ou JS. Ensine as regras de segurança do Firebase necessárias. Formate os códigos dentro de blocos de Markdown (\`\`\`html, \`\`\`javascript).`;

        const MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const contents = chatHistoryAdmin.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
        contents.push({ role: 'user', parts: [{ text: msgAdmin }] });

        const res = await fetch(MODEL_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: contents, systemInstruction: { parts: [{ text: promptDesenvolvedor }] } })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        
        const respostaDev = data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro.";
        
        chatHistoryAdmin.push({ role: 'user', text: msgAdmin });
        chatHistoryAdmin.push({ role: 'model', text: respostaDev });

        return respostaDev;
    } catch(e) {
        return "Erro de compilação na IA: " + e.message;
    }
}

export function resetarChatAdmin() {
    chatHistoryAdmin = [];
}
