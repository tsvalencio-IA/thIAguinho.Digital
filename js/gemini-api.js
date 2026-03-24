// NOME DO FICHEIRO: gemini-api.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { database, ref, push, set, get } from './firebase-config.js';

let chatHistory = [];
let chaveApiArmazenada = null; // A chave será puxada do Firebase

// =========================================================================
// O CÉREBRO: ARQUITETO DE SISTEMAS (FACILITÓIDES)
// =========================================================================
export let systemPrompt = `Você é o Arquiteto de Software e Mascote Vendedor de Realidade Aumentada da 'thIAguinho Soluções Digitais'.
A sua missão é atuar como um engenheiro de soluções sénior. Deve entrevistar o utilizador, entender a sua dor real e criar uma solução inteligente e prática que funcione (um "Facilitóide").

FLUXO DA ENTREVISTA VERDADEIRA:
1. Boas-vindas: Diga que é o mascote inteligente da thIAguinho. Pergunte o NOME do cliente e a EMPRESA.
2. Identificação da Dor: "Para que eu desenhe a solução perfeita, diga-me: qual é o processo que hoje toma mais tempo, dinheiro ou gera desorganização na sua empresa?"
3. Criação do Facilitóide (A Mágica): Aja como um programador especialista. Com base na resposta, desenhe um sistema ou automação exata:
   -> Se o problema for gestão/papéis: "Perfeito. Acabei de idealizar um Facilitóide para si: Um CRM Web integrado ao WhatsApp, onde a sua equipa arrasta as tarefas e o sistema faz o seguimento automático."
   -> Se o problema for atendimento: "Problema resolvido. O seu Facilitóide será: Uma Inteligência Artificial no vosso WhatsApp que atende, vende e agenda serviços 24h por dia no calendário."
   -> Se quiser inovação para vendas: "O seu Facilitóide será uma experiência em Realidade Aumentada onde o seu catálogo salta em 3D."
4. Fechamento: Diga que a nossa equipa de desenvolvimento programa isto rapidamente. Peça o número de WhatsApp para que o Thiago (nosso Gestor) possa mostrar-lhe a arquitetura pronta e enviar a proposta.

REGRA TÉCNICA OBRIGATÓRIA (SISTEMA DE CAPTAÇÃO):
Assim que o cliente fornecer o WhatsApp, agradeça. Exatamente no FINAL da sua mensagem de agradecimento, deve gerar o código oculto para a nossa base de dados ler o projeto.
O formato DEVE ser rigorosamente este (seja claro a detalhar a solução na tag FACILITOIDE):

[LEAD: NOME=... | EMPRESA=... | DORES=... | FACILITOIDE=... | WHATSAPP=...]`;


export function atualizarPromptMemoria(novoPrompt) {
    if (novoPrompt && novoPrompt.trim() !== '') {
        systemPrompt = novoPrompt;
    }
}

// Procura a Chave da API guardada no Painel Admin
async function obterChaveDaApi() {
    if (chaveApiArmazenada) return chaveApiArmazenada;
    try {
        const snapshot = await get(ref(database, 'configuracoes/gemini_api_key'));
        if (snapshot.exists()) {
            chaveApiArmazenada = snapshot.val();
            return chaveApiArmazenada;
        }
    } catch (e) {
        console.error("Erro ao ler a chave da API:", e);
    }
    return null;
}

export async function askGemini(msgUsuario) {
    try {
        const apiKey = await obterChaveDaApi();
        if (!apiKey) {
            return "Aviso do Sistema: O administrador da Agência ainda não configurou a chave da Inteligência Artificial no Painel. Por favor, aceda à área de Administração e insira a chave da API do Gemini.";
        }

        const MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

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
        
        let botReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Falha nos meus circuitos.";
        
        // INTERCEPTAÇÃO: O Regex extrai o Facilitóide desenhado e guarda no Firebase
        const regexLead = /\[LEAD:\s*NOME=([\s\S]*?)\|\s*EMPRESA=([\s\S]*?)\|\s*DORES=([\s\S]*?)\|\s*FACILITOIDE=([\s\S]*?)\|\s*WHATSAPP=([\s\S]*?)\]/i;
        const match = botReply.match(regexLead);
        
        if (match) {
            const [, nome, empresa, dores, facilitoide, whatsapp] = match;
            
            const novoLeadRef = push(ref(database, 'leads'));
            set(novoLeadRef, {
                nome: nome.trim(),
                empresa: empresa.trim(),
                dores: dores.trim(),
                facilitoide: facilitoide.trim(),
                whatsapp: whatsapp.trim(),
                data: new Date().toISOString()
            });

            // Remove a linguagem de programação da vista do cliente
            botReply = botReply.replace(regexLead, '').trim();
        }

        return botReply;

    } catch(e) {
        console.error("Erro Gemini:", e);
        return "Ops! Estou a processar as engrenagens de IA. Pode repetir a mensagem?";
    }
}

export function adicionarAoHistorico(role, texto) {
    chatHistory.push({ role: role, text: texto });
}