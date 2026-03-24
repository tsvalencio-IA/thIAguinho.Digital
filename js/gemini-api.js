import { salvarLeadFirestore } from './admin.js';

// SUBSTITUA AQUI PELA SUA CHAVE DO GOOGLE GEMINI
const apiKey = "SUA_CHAVE_DO_GEMINI_AQUI"; 
const MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

export let systemInstruction = `Você é o Mascote Vendedor da agência de inovação 'thIAguinho Soluções Digitais'.
Seu tom é profissional, tecnológico, amigável e focado em vendas B2B.

FLUXO DE VENDA OBRIGATÓRIO:
1. Apresente-se e pergunte o NOME e o RAMO DE NEGÓCIO da empresa do cliente.
2. Seja consultivo: "Quais os maiores gargalos de perda de tempo/dinheiro que você enfrenta hoje?"
3. Ofereça nossas soluções: IA, Plataformas SaaS e Realidade Aumentada.
4. Peça o WhatsApp do cliente para que nosso especialista (Thiago) envie uma proposta.
5. ASSIM QUE ELE FORNECER O WHATSAPP E OS DADOS, inclua EXATAMENTE esta tag oculta no final da sua resposta:
[LEAD: NOME=... | EMPRESA=... | DOR=... | WHATSAPP=...]`;

export let chatHistory = [];

export function setSystemInstruction(prompt) {
    systemInstruction = prompt;
}

export async function askGemini(userText) {
    try {
        const contents = chatHistory.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));
        contents.push({ role: 'user', parts: [{ text: userText }] });

        const response = await fetch(MODEL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                systemInstruction: { parts: [{ text: systemInstruction }] }
            })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        
        let botReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, falha no sistema.";
        
        // Interceptador Automático de Leads (Puxa os dados para o CRM)
        const leadRegex = /\[LEAD:\s*NOME=(.*?)\s*\|\s*EMPRESA=(.*?)\s*\|\s*DOR=(.*?)\s*\|\s*WHATSAPP=(.*?)\]/i;
        const match = botReply.match(leadRegex);
        
        if (match) {
            const [, nome, empresa, dor, whatsapp] = match;
            salvarLeadFirestore({ nome: nome.trim(), empresa: empresa.trim(), dor: dor.trim(), whatsapp: whatsapp.trim() });
            // Esconde a tag para o usuário final não ver
            botReply = botReply.replace(leadRegex, '').trim(); 
        }

        return botReply;

    } catch (error) {
        console.error("Gemini API Error:", error);
        return "Ops! Estou com problemas na minha conexão de rede no momento.";
    }
}
