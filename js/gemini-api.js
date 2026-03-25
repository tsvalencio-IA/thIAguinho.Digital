// NOME DO FICHEIRO: gemini-api.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { database, ref, push, set, get } from './firebase-config.js';

let chatHistory = [];
let chaveApiArmazenada = null; // A variável que vai procurar a chave na base de dados

// =========================================================================
// O CÉREBRO: ARQUITETO DE SISTEMAS (FACILITÓIDES)
// =========================================================================
export let systemPrompt = `Atuas como Arquiteto de Software e Mascote Vendedor de Realidade Aumentada da 'thIAguinho Soluções Digitais'.
A tua missão é ser resolutivo: Entrevista o utilizador, identifica o problema de gestão/vendas e CRIA um Facilitóide (um sistema prático, automação ou aplicação) exato para ele.

FLUXO DA ENTREVISTA (Sê prático e direto):
1. Cumprimento: "Olá, sou o mascote arquiteto da thIAguinho! Qual é o teu nome e de que empresa falas?"
2. O Problema: "Qual é hoje a tarefa mais repetitiva, o gargalo ou a desorganização que faz a tua equipa perder dinheiro e tempo?"
3. A Engenharia (Criação do Facilitóide): Com base na dor, apresenta uma solução lógica.
   -> Exemplo de Dor (Tempo perdido em conversas): "O teu Facilitóide será: Uma Inteligência Artificial ligada ao teu WhatsApp que responde a dúvidas comuns e agenda marcações no teu calendário automaticamente."
   -> Exemplo de Dor (Planilhas confusas): "O teu Facilitóide será: Um CRM Web personalizado onde podes gerir todos os dados da empresa de forma visual e arrastar processos."
4. O Fechamento: "A nossa equipa programa isto para ti. Deixa-me o teu WhatsApp para o Thiago (nosso programador chefe) te enviar a estrutura deste projeto e falarmos do orçamento."

REGRA DE CAPTAÇÃO OBRIGATÓRIA (SISTEMA DE BASE DE DADOS):
No exato momento em que ele te fornecer o WhatsApp, agradece. No FINAL ABSOLUTO da tua mensagem de agradecimento, DEVES colocar esta tag oculta para que o nosso sistema guarde a arquitetura que criaste.
O formato DEVE ser este (cria o campo FACILITOIDE com o resumo da tua ideia):

[LEAD: NOME=... | EMPRESA=... | DORES=... | FACILITOIDE=... | WHATSAPP=...]`;


export function atualizarPromptMemoria(novoPrompt) {
    if (novoPrompt && novoPrompt.trim() !== '') {
        systemPrompt = novoPrompt;
    }
}

// PROCURA A CHAVE NO FIREBASE ANTES DE FALAR COM A IA
async function obterChaveDaApi() {
    if (chaveApiArmazenada) return chaveApiArmazenada;
    try {
        const snapshot = await get(ref(database, 'configuracoes/gemini_api_key'));
        if (snapshot.exists()) {
            chaveApiArmazenada = snapshot.val();
            return chaveApiArmazenada;
        }
    } catch (e) {
        console.error("Erro ao procurar a chave na base de dados:", e);
    }
    return null;
}

export async function askGemini(msgUsuario) {
    try {
        const apiKey = await obterChaveDaApi();
        if (!apiKey) {
            return "Aviso do Sistema: O administrador da Agência ainda não configurou a chave da Inteligência Artificial no Painel. Aceda à área de Administração e insira a chave da API do Gemini para me ativar.";
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
        
        // MÁGICA: O Regex capta até as quebras de linha que a IA fizer na arquitetura do sistema
        const regexLead = /\[LEAD:\s*NOME=([\s\S]*?)\|\s*EMPRESA=([\s\S]*?)\|\s*DORES=([\s\S]*?)\|\s*FACILITOIDE=([\s\S]*?)\|\s*WHATSAPP=([\s\S]*?)\]/i;
        const match = botReply.match(regexLead);
        
        if (match) {
            const [, nome, empresa, dores, facilitoide, whatsapp] = match;
            
            // Envia o Projeto Estruturado para o Painel da Agência
            const novoLeadRef = push(ref(database, 'leads'));
            set(novoLeadRef, {
                nome: nome.trim(),
                empresa: empresa.trim(),
                dores: dores.trim(),
                facilitoide: facilitoide.trim(),
                whatsapp: whatsapp.trim(),
                data: new Date().toISOString()
            });

            // Retira a marcação de código da resposta para o utilizador final
            botReply = botReply.replace(regexLead, '').trim();
        }

        return botReply;

    } catch(e) {
        console.error("Erro Gemini:", e);
        return "Ops! Estou a processar as engrenagens de IA. Pode repetir a sua mensagem?";
    }
}

export function adicionarAoHistorico(role, texto) {
    chatHistory.push({ role: role, text: texto });
}
