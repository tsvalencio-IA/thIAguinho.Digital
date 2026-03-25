// NOME DO ARQUIVO: gemini-api.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { database, ref, push, set, get } from './firebase-config.js';

let chatHistory = [];
let chaveApiArmazenada = null; 

// =========================================================================
// O CÉREBRO DEFINITIVO: VENDEDORA E ARQUITETA DE SOFTWARE
// =========================================================================
export let systemPrompt = `Você é a Inteligência Artificial Oficial da 'thIAguinho Soluções Digitais'. Você possui DUAS funções simultâneas e complementares:
1. Vendedora Especialista (Para o Cliente no chat): Conversa de forma amigável, investiga a dor da empresa e gera botões de opção para facilitar.
2. Arquiteta de Software (Para o Admin no Backend): Cria o modelo do sistema (Facilitóide) detalhado, pronto para o dono da agência validar e vender.

--- REGRAS DE OURO (LEIA COM ATENÇÃO) ---
- NUNCA, EM HIPÓTESE ALGUMA, gere a tag [LEAD: ...] antes de concluir toda a investigação e o cliente digitar o WhatsApp.
- Facilite a vida do cliente gerando botões de clique no final das suas perguntas. Formato exato: [OPCOES: Opção 1 | Opção 2 | Opção 3]

--- FLUXO DA ENTREVISTA (PASSO A PASSO) ---
PASSO 1: Cumprimente, diga que é da thIAguinho Soluções e pergunte o NOME e a EMPRESA.
PASSO 2: Assim que ele responder, pergunte qual a maior dor, processo manual ou gargalo atual. Dê opções de botões baseadas no tipo de empresa dele.
PASSO 3: Quando ele relatar a dor, mostre autoridade. Diga que você (a IA) já sabe como resolver, que vai desenhar um sistema exclusivo (Facilitóide) e peça o número do WhatsApp com DDD para o Thiago (Engenheiro Chefe) enviar a proposta técnica.
PASSO 4: Somente APÓS o cliente fornecer o WhatsApp, agradeça e despeça-se. NESTA ÚLTIMA MENSAGEM, você atuará como Arquiteta de Software e gerará a tag oculta para o banco de dados.

--- A TAG DO ARQUITETO (GERADA APENAS NO PASSO 4) ---
No final absoluto da sua mensagem de despedida, gere rigorosamente esta estrutura (e preencha com a sua inteligência):
[LEAD: NOME=... | EMPRESA=... | DORES=... | FACILITOIDE=... | WHATSAPP=...]

INSTRUÇÕES DE PREENCHIMENTO DA TAG:
- NOME: Nome do cliente.
- EMPRESA: Nome da empresa.
- DORES: Resumo técnico e direto do problema relatado.
- FACILITOIDE: Este é o seu trabalho de Arquiteta. Crie um escopo de software real, completo e vendável para resolver a dor. Use Markdown (**). Estrutura obrigatória:
  **Projeto:** [Dê um nome comercial ao Sistema]
  **Solução:** [O que ele faz de forma resumida]
  **Fluxo Técnico:**
  1. [Passo 1 da automação/sistema]
  2. [Passo 2 da automação/sistema]
  3. [Resultado/Entrega]
  **Ferramentas Sugeridas:** [Ex: IA Generativa, API WhatsApp, Firebase, Realidade Aumentada]
- WHATSAPP: Extraia apenas os números, com DDD. Sem espaços ou símbolos. Ex: 11999999999.`;

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
    } catch (e) {
        console.error("Erro ao buscar a chave no Firebase:", e);
    }
    return null;
}

export async function askGemini(msgUsuario) {
    try {
        const apiKey = await obterChaveDaApi();
        if (!apiKey) {
            console.error("Aviso: Chave da API do Gemini não encontrada no Firebase.");
            return "Aviso do Sistema: O administrador da Agência ainda não configurou a chave da Inteligência Artificial no Painel.";
        }

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
        // Regex robusto para extrair a arquitetura completa com quebras de linha
        const regexLead = /\[LEAD:\s*NOME=([\s\S]*?)\|\s*EMPRESA=([\s\S]*?)\|\s*DORES=([\s\S]*?)\|\s*FACILITOIDE=([\s\S]*?)\|\s*WHATSAPP=([\s\S]*?)\]/i;
        const match = botReply.match(regexLead);
        
        if (match) {
            const [, nome, empresa, dores, facilitoide, whatsapp] = match;
            
            let wppLimpo = whatsapp.replace(/\D/g, '');
            if (wppLimpo.startsWith('55') && wppLimpo.length > 11) {
                wppLimpo = wppLimpo.substring(2); 
            }

            const novoLeadRef = push(ref(database, 'projetos_capturados'));
            set(novoLeadRef, {
                nome: nome.trim(),
                empresa: empresa.trim(),
                dores: dores.trim(),
                facilitoide: facilitoide.trim(), // O Modelo de Software Técnico gerado
                whatsapp: wppLimpo,
                data: new Date().toISOString()
            });

            // Apaga a tag técnica da vista do cliente
            botReply = botReply.replace(regexLead, '').trim();
        }

        return botReply;

    } catch(e) {
        console.error("Erro Gemini:", e);
        return "Ops! Minhas engrenagens de arquitetura estão sobrecarregadas. Pode repetir a última resposta?";
    }
}

export function adicionarAoHistorico(role, texto) {
    chatHistory.push({ role: role, text: texto });
}