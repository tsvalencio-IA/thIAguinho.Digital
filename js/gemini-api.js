import { database, ref, push, set, get } from './firebase-config.js';

let chatHistory = [];
let chaveApiArmazenada = null; 

// O Arquiteto (Facilitóide Maker)
export let systemPrompt = `Você é o Arquiteto de Software e Mascote Vendedor da 'thIAguinho Soluções Digitais'.
Sua missão é entrevistar o usuário, entender a sua dor real e criar um "Facilitóide" (um sistema prático, automação ou aplicação).

FLUXO DA ENTREVISTA (Seja prático e humano):
1. Boas-vindas: "Olá, sou o mascote arquiteto da thIAguinho! Qual é o seu nome e de que empresa você fala?"
2. O Problema: "Qual é o gargalo ou a desorganização que hoje faz a sua equipe perder tempo ou dinheiro?"
3. A Criação do Facilitóide: Baseado na dor, desenhe e explique uma solução.
   -> Exemplo (Demora no WhatsApp): "O seu Facilitóide será: Uma Inteligência Artificial no seu WhatsApp que atende clientes, vende e agenda no seu calendário 24h por dia."
   -> Exemplo (Planilhas confusas): "O seu Facilitóide será: Um CRM Web personalizado para a sua empresa. Você vai arrastar as tarefas e ter controle total visualmente."
4. O Fechamento: "Nossa equipe desenvolve isso rápido. Deixe o seu WhatsApp para o Thiago (nosso programador chefe) entrar em contato e mostrar o projeto estruturado."

REGRA TÉCNICA OBRIGATÓRIA (SISTEMA DE CAPTAÇÃO):
Quando o cliente fornecer o WhatsApp, agradeça. No FINAL ABSOLUTO da sua mensagem, gere esta tag oculta para o banco de dados captar a arquitetura.
Formato exato:
[LEAD: NOME=... | EMPRESA=... | DORES=... | FACILITOIDE=... | WHATSAPP=...]`;

export function atualizarPromptMemoria(novoPrompt) {
    if (novoPrompt && novoPrompt.trim() !== '') systemPrompt = novoPrompt;
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
        console.error("Erro ao buscar a chave:", e);
    }
    return null;
}

export async function askGemini(msgUsuario) {
    try {
        const apiKey = await obterChaveDaApi();
        if (!apiKey) {
            return "Aviso: A Chave da API do Gemini não foi configurada. Acesse o Painel da Agência para inserir a chave.";
        }

        // Utilizando a versão 2.5 flash solicitada
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
        
        let botReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Falha neural.";
        
        // INTERCEPTAÇÃO E CRIAÇÃO DO FACILITÓIDE NO CRM
        const regexLead = /\[LEAD:\s*NOME=([\s\S]*?)\|\s*EMPRESA=([\s\S]*?)\|\s*DORES=([\s\S]*?)\|\s*FACILITOIDE=([\s\S]*?)\|\s*WHATSAPP=([\s\S]*?)\]/i;
        const match = botReply.match(regexLead);
        
        if (match) {
            const [, nome, empresa, dores, facilitoide, whatsapp] = match;
            
            const novoLeadRef = push(ref(database, 'projetos_capturados'));
            set(novoLeadRef, {
                nome: nome.trim(),
                empresa: empresa.trim(),
                dores: dores.trim(),
                facilitoide: facilitoide.trim(),
                whatsapp: whatsapp.trim(),
                data: new Date().toISOString()
            });

            botReply = botReply.replace(regexLead, '').trim();
        }

        return botReply;

    } catch(e) {
        console.error("Erro Gemini:", e);
        return "Ops! Estou compilando o projeto na nuvem. Pode repetir?";
    }
}

export function adicionarAoHistorico(role, texto) {
    chatHistory.push({ role: role, text: texto });
}
