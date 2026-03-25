// NOME DO FICHEIRO: gemini-api.js
// LOCALIZAÇÃO: Fica OBRIGATORIAMENTE dentro da pasta 'js' (Substitua tudo o que lá estiver)

import { database, ref, push, set, get } from './firebase-config.js';

let chatHistoryCliente = [];
let chatHistoryAdmin = []; // Histórico separado para o chat de programação
let chaveApiArmazenada = null; 

// =========================================================================
// CÉREBRO 1: A VENDEDORA E ARQUITETA (MÁQUINA DE ESTADOS RÍGIDA)
// =========================================================================
export let systemPrompt = `És a IA central da 'thIAguinho Soluções Digitais'. Tens 2 funções invisíveis para o cliente: Vendedora Empática e Arquiteta Sénior.

REGRA DE OURO DA MÁQUINA DE ESTADOS (SEGUE A ORDEM, NÃO SALTES PASSOS):
Usa sempre botões [OPCOES: A | B] para facilitar a resposta.

PASSO 1 (Triagem): Cumprimenta. Pergunta quem é e se procura soluções para a Empresa ou Vida Pessoal/Rotina.
PASSO 2 (A Dor): Investiga PROFUNDAMENTE. Se for Empresa (Onde perde mais dinheiro/tempo? Oficina? Vendas?). Se for Pessoal (Qual a rotina mais caótica?).
PASSO 3 (O Sistema): Quando descobrires "A Verdade" (a dor real), mostra autoridade. Diz: "A thIAguinho cria sistemas exatos para isso. Vou desenhar o modelo técnico." e PEDE O WHATSAPP COM INDICATIVO.
PASSO 4 (A Arquitetura): SÓ DEPOIS de receber o WhatsApp, agradece e despede-te. NESTA MENSAGEM FINAL GERA A TAG ABAIXO.

FORMATO OBRIGATÓRIO DA TAG FINAL (O ESCUDO TÉCNICO PARA O THIAGO):
[LEAD: NOME=... | EMPRESA=... | DORES=... | FACILITOIDE=... | WHATSAPP=...]

COMO PREENCHER "FACILITOIDE":
Usa a tua mente de Arquiteta Sénior. Estrutura em Markdown.
**Projeto:** [Nome do App/Sistema]
**A Lógica:** [Como funciona na prática]
**Stack Técnico:** [Ex: Front-end em GitHub Pages; Guardar fotos no Cloudinary; Firebase Realtime Database para validar a regra de negócio da dor].`;

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

        const promptDesenvolvedor = `És um Engenheiro de Software Full-Stack a trabalhar para o Thiago (Dono da Agência thIAguinho Soluções). O vosso Stack é: HTML/JS Tailwind (hospedado em GitHub Pages), Firebase (Realtime Database) e Cloudinary (para imagens).
        O contexto do projeto que o Thiago quer programar agora é este: ${contextoProjeto}
        
        Seja prático. Quando o Thiago pedir, entrega os códigos completos e exatos que ele só precisa de copiar e colar num ficheiro único HTML se for interface, ou JS. Ensina as regras de segurança do Firebase necessárias. Formata os códigos dentro de blocos de Markdown (\`\`\`html, \`\`\`javascript).`;

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
        
        // Guarda o histórico da programação
        chatHistoryAdmin.push({ role: 'user', text: msgAdmin });
        chatHistoryAdmin.push({ role: 'model', text: respostaDev });

        return respostaDev;
    } catch(e) {
        return "Erro de compilação na IA: " + e.message;
    }
}

// Limpa a memória quando se abre um projeto novo no Canvas
export function resetarChatAdmin() {
    chatHistoryAdmin = [];
}
