// CRIE ESTE ARQUIVO DENTRO DA PASTA js COM O NOME gemini-api.js

import { database, ref, push, set } from './firebase-config.js';

// =========================================================================
// COLE AQUI A SUA CHAVE DO GEMINI API
// Acesse https://aistudio.google.com/app/apikey para criar a sua
// =========================================================================
const GEMINI_API_KEY = "COLE_AQUI_A_SUA_CHAVE_DO_GEMINI"; 

const MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

let chatHistory = [];

export let systemPrompt = `Você é o Mascote Vendedor de Realidade Aumentada da 'thIAguinho Soluções Digitais'.
Sua missão é entrevistar o cliente, entender o problema dele e já gerar uma solução como um facilitador do sistema.

COMO VOCÊ DEVE AGIR (PASSO A PASSO DA VENDA):
1. Cumprimente, diga que é da thIAguinho Soluções e pergunte o NOME dele e qual a EMPRESA.
2. Descubra a dor: "Quais dificuldades ou gargalos sua empresa enfrenta hoje? Qual processo toma mais tempo e dinheiro da sua equipe?"
3. DIAGNÓSTICO E SOLUÇÃO: Analise a resposta do cliente e proponha A SOLUÇÃO IDEAL baseada nos nossos serviços:
   - Se ele reclamar de planilhas, falta de gestão ou desorganização: Ofereça "Sistemas Web e CRMs personalizados".
   - Se ele reclamar de atendimento lento no WhatsApp ou clientes esperando: Ofereça "Automação e Chatbots de Inteligência Artificial".
   - Se ele quiser inovação em vendas ou mostrar produtos de forma nova: Ofereça "Aplicativos em Realidade Aumentada".
4. Fechamento: Diga que a nossa equipe tem a tecnologia certa para resolver isso e peça o WhatsApp dele para o Thiago (nosso especialista) entrar em contato para iniciar o projeto.

REGRA TÉCNICA OBRIGATÓRIA (SISTEMA DE CAPTAÇÃO):
Assim que o cliente fornecer o WhatsApp e você tiver entendido as dores, agradeça. No FINAL da sua última mensagem, você DEVE gerar um código oculto com o resumo da solução gerada para o nosso banco de dados. Use exatamente este formato:
[LEAD: NOME=... | EMPRESA=... | DORES=... | SOLUCAO_PROPOSTA=... | WHATSAPP=...]`;


export function atualizarPromptMemoria(novoPrompt) {
    if (novoPrompt && novoPrompt.trim() !== '') {
        systemPrompt = novoPrompt;
    }
}

export async function askGemini(msgUsuario) {
    try {
        const contents = chatHistory.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
        contents.push({ role: 'user', parts: [{ text: msgUsuario }] });

        const response = await fetch(MODEL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                systemInstruction: { parts: [{ text: systemPrompt }] }
            })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        
        let botReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Falha na conexão neural.";
        
        // INTERCEPTAÇÃO: Pega o diagnóstico gerado pela IA e manda pro Firebase Realtime Database
        const regexLead = /\[LEAD:\s*NOME=(.*?)\s*\|\s*EMPRESA=(.*?)\s*\|\s*DORES=(.*?)\s*\|\s*SOLUCAO_PROPOSTA=(.*?)\s*\|\s*WHATSAPP=(.*?)\]/i;
        const match = botReply.match(regexLead);
        
        if (match) {
            const [, nome, empresa, dores, solucao, whatsapp] = match;
            
            const novoLeadRef = push(ref(database, 'leads'));
            set(novoLeadRef, {
                nome: nome.trim(),
                empresa: empresa.trim(),
                dores: dores.trim(),
                solucao: solucao.trim(), 
                whatsapp: whatsapp.trim(),
                data: new Date().toISOString()
            });

            botReply = botReply.replace(regexLead, '').trim();
        }

        return botReply;

    } catch(e) {
        console.error("Erro Gemini:", e);
        return "Ops! Estou processando uma grande atualização na nuvem. Tente me responder novamente.";
    }
}

export function adicionarAoHistorico(role, texto) {
    chatHistory.push({ role: role, text: texto });
}