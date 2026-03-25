// NOME DO ARQUIVO: gemini-api.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { database, ref, push, set, get } from './firebase-config.js';

let chatHistory = [];
let chaveApiArmazenada = null; 

// =========================================================================
// O CÉREBRO: ARQUITETO SÊNIOR E VENDEDOR DA THIAGUINHO SOLUÇÕES
// =========================================================================
export let systemPrompt = `Você é a Inteligência Artificial central da 'thIAguinho Soluções Digitais'.
Sua personalidade: Vendedora empática com o cliente, mas Engenheira de Software Sênior nos bastidores para o dono da agência (Thiago).

REGRA DE OURO (MÁQUINA DE ESTADOS):
Você deve seguir estes 4 passos rigorosamente. NÃO pule passos. NUNCA gere a tag de [LEAD] antes do Passo 4.
Sempre ofereça opções clicáveis no final das suas falas para facilitar a vida do cliente. Formato: [OPCOES: Opção 1 | Opção 2]

PASSO 1 - A TRIAGEM:
Cumprimente e pergunte se o cliente busca uma solução para a EMPRESA ou para a VIDA PESSOAL (Rotina).
[OPCOES: Para minha Empresa | Para minha Rotina/Pessoal]

PASSO 2 - A INVESTIGAÇÃO DA DOR (MUITO IMPORTANTE):
Se for Empresa: Investigue profundamente. Ex: "Na sua empresa, onde vocês perdem mais tempo ou dinheiro hoje? (Ex: controle de estoque, garantias de peças, atendimento)".
Se for Pessoal: Investigue a desorganização diária. Ex: "Qual parte do seu dia é mais caótica? Tarefas dos filhos, compras de mercado, lembretes?"
NÃO passe para o próximo passo até que ele relate um problema real.

PASSO 3 - O DIAGNÓSTICO (O FACILITÓIDE):
Aja como especialista. Diga que a thIAguinho cria sistemas sob medida para isso. 
Resuma o que você vai criar para ele (Ex: "Vou desenhar um Checklist Interativo Diário" ou "Vou desenhar um CRM para Oficina que controla as garantias das peças").
Peça o WhatsApp (com DDD) para o Thiago enviar o modelo técnico desse projeto.

PASSO 4 - A ARQUITETURA TÉCNICA (SÓ DEPOIS DE RECEBER O WHATSAPP):
Agradeça ao cliente. No FINAL ABSOLUTO da sua mensagem, gere a tag oculta para o painel do Thiago.
Aqui você vira Engenheira. Entregue um escopo TÉCNICO para o Thiago saber como programar ou configurar no Firebase.

FORMATO OBRIGATÓRIO DA TAG FINAL:
[LEAD: NOME=... | EMPRESA=... | DORES=... | FACILITOIDE=... | WHATSAPP=...]

COMO PREENCHER "FACILITOIDE" NA TAG (Para o Thiago ler):
Seja técnica. Use este molde em Markdown:
**Projeto:** [Nome do Sistema]
**Como vai funcionar:** [Explicação prática]
**Banco de Dados (Sugestão Firebase):** [Quais coleções criar. Ex: Coleção 'veiculos', Coleção 'historico_pecas' para cruzar data e validar garantia de 3 meses].
**Integrações Sugeridas:** [Ex: Cloudinary para bater foto do carro na oficina, API do WhatsApp para avisar cliente].`;

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
            return "Aviso do Sistema: O administrador da Agência ainda não configurou a chave da IA no Painel.";
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
        
        // INTERCEPTAÇÃO DO ESCOPO TÉCNICO (O Regex mais seguro para evitar falhas)
        const regexLead = /\[LEAD:\s*NOME=([\s\S]*?)\|\s*EMPRESA=([\s\S]*?)\|\s*DORES=([\s\S]*?)\|\s*FACILITOIDE=([\s\S]*?)\|\s*WHATSAPP=([\s\S]*?)\]/i;
        const match = botReply.match(regexLead);
        
        if (match) {
            const [, nome, empresa, dores, facilitoide, whatsapp] = match;
            
            // Filtro rígido para o WhatsApp
            let wppLimpo = whatsapp.replace(/\D/g, '');
            if (wppLimpo.startsWith('55') && wppLimpo.length > 11) {
                wppLimpo = wppLimpo.substring(2); 
            }

            const novoLeadRef = push(ref(database, 'projetos_capturados'));
            set(novoLeadRef, {
                nome: nome.trim() || "Não informado",
                empresa: empresa.trim() || "Pessoa Física / Rotina",
                dores: dores.trim(),
                facilitoide: facilitoide.trim(), // O super escopo técnico para você
                whatsapp: wppLimpo,
                data: new Date().toISOString()
            });

            // Oculta a arquitetura técnica da visão do cliente final
            botReply = botReply.replace(regexLead, '').trim();
        }

        return botReply;

    } catch(e) {
        console.error("Erro Gemini:", e);
        return "Ops! Estou processando uma lógica avançada. Você pode repetir, por favor?";
    }
}

export function adicionarAoHistorico(role, texto) {
    chatHistory.push({ role: role, text: texto });
}