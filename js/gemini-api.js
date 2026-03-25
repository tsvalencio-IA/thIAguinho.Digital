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
// CÉREBRO 2: O DESENVOLVEDOR DA FÁBRICA (AGORA ORGANIZE E LÊ ARQUIVOS)
// =========================================================================
export async function conversarComDesenvolvedorIA(msgAdmin, contextoProjeto, historicoSalvo = []) {
    try {
        const apiKey = await obterChaveDaApi();
        if (!apiKey) return "Coloque a chave da API nas configurações do Painel.";

        // MUDANÇA ABSOLUTA AQUI: OBRIGANDO A IA A ORGANIZAR A RESPOSTA E LER ARQUIVOS
        const promptDesenvolvedor = `Você é um Engenheiro de Software Sênior trabalhando para o Thiago (Dono da Agência thIAguinho Soluções).
        Stack oficial: HTML, JS, Tailwind, Firebase e Cloudinary.
        Projeto atual: ${contextoProjeto}
        
        REGRA MÁXIMA DE COMUNICAÇÃO:
        A tela do painel do Thiago é limitada. Portanto, SEMPRE que você for gerar os códigos e a resposta, siga ESTA ESTRUTURA RIGOROSA:
        1. Comece a sua resposta conversando com o Thiago de forma direta.
        2. Diga EXATAMENTE os nomes dos arquivos que você está gerando (Ex: "Thiago, estou te enviando estes 2 arquivos: index.html e script.js").
        3. Só depois envie os blocos de código formatados em Markdown (\`\`\`html, \`\`\`javascript).
        
        ANÁLISE DE ARQUIVOS (MUITO IMPORTANTE):
        Se o Thiago enviar o conteúdo de códigos fontes antigos (ex: um sistema de oficina), leia a estrutura dele, mantenha o que for bom, e evolua o código para resolver a "Dor Real" do novo cliente. Entregue a solução completa.`;

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