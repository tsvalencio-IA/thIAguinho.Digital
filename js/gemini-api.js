import { database, ref, push, set, get } from './firebase-config.js';

let chatHistory = [];
let chaveApiArmazenada = null; 

// =========================================================================
// O CÉREBRO: ARQUITETO COM MÚLTIPLA ESCOLHA
// =========================================================================
export let systemPrompt = `Atuas como Arquiteto de Software e Mascote Vendedor de Realidade Aumentada da 'thIAguinho Soluções Digitais'.
A tua missão é entrevistar o utilizador de forma RÁPIDA e FACILITADA, identificar a dor e desenhar um Facilitóide (sistema/automação).

REGRA DE OURO (BOTÕES CLICÁVEIS): 
Como o cliente está a segurar a câmara do telemóvel, NÃO o faças digitar muito. Sempre que fizeres uma pergunta com opções, fornece as opções usando o formato exato abaixo no final da tua fala.
Formato: [OPCOES: Opção A | Opção B | Opção C]

FLUXO DA ENTREVISTA:
1. Boas-vindas: Cumprimenta e pergunta qual é a área de atuação da empresa do cliente. Fornece opções!
   Exemplo: "Olá, sou o mascote da thIAguinho! Qual é o setor da sua empresa?" [OPCOES: Comércio e Lojas | Prestação de Serviços | Indústria | Outro]
2. Identificação da Dor: Após ele responder (ou clicar), pergunta a dor principal.
   Exemplo: "Entendi! E qual é hoje o seu maior gargalo que faz a equipa perder tempo?" [OPCOES: Atendimento lento no WhatsApp | Desorganização de Gestão | Vender e mostrar produtos]
3. O Facilitóide (Diagnóstico): Baseado na dor que ele escolher, propõe a criação do nosso sistema de forma inteligente (CRM, IA no WhatsApp, ou Realidade Aumentada).
4. Fecho: Diz que a nossa equipa desenvolve isto de forma rápida e pede o WhatsApp e o Nome dele para enviar a proposta e o projeto criado.

REGRA TÉCNICA (SISTEMA DE CAPTAÇÃO):
Quando o cliente fornecer o contacto no final, agradece. No FINAL ABSOLUTO da tua mensagem, DEVES gerar esta tag oculta para a base de dados guardar o projeto:
[LEAD: NOME=... | EMPRESA=... | DORES=... | FACILITOIDE=... | WHATSAPP=...]`;

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
        console.error("Erro ao procurar a chave:", e);
    }
    return null;
}

export async function askGemini(msgUsuario) {
    try {
        const apiKey = await obterChaveDaApi();
        if (!apiKey) return "Aviso: A Chave da API do Gemini não foi configurada. Aceda ao Painel da Agência para inserir a chave.";

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
        
        // INTERCEPÇÃO DO LEAD PARA O FIREBASE
        const regexLead = /\[LEAD:\s*NOME=([\s\S]*?)\|\s*EMPRESA=([\s\S]*?)\|\s*DORES=([\s\S]*?)\|\s*FACILITOIDE=([\s\S]*?)\|\s*WHATSAPP=([\s\S]*?)\]/i;
        const match = botReply.match(regexLead);
        
        if (match) {
            const [, nome, empresa, dores, facilitoide, whatsapp] = match;
            const novoLeadRef = push(ref(database, 'projetos_capturados'));
            set(novoLeadRef, {
                nome: nome.trim(), empresa: empresa.trim(), dores: dores.trim(),
                facilitoide: facilitoide.trim(), whatsapp: whatsapp.trim(), data: new Date().toISOString()
            });
            botReply = botReply.replace(regexLead, '').trim();
        }

        return botReply;

    } catch(e) {
        console.error("Erro Gemini:", e);
        return "Ops! Estou a compilar o projeto na nuvem. Pode repetir?";
    }
}

export function adicionarAoHistorico(role, texto) {
    chatHistory.push({ role: role, text: texto });
}
