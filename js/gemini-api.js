// NOME DO ARQUIVO: gemini-api.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { database, ref, push, set, get } from './firebase-config.js';

let chatHistory = [];
let chaveApiArmazenada = null; 

// =========================================================================
// O CÉREBRO: FÁBRICA DE SOFTWARE (CANVAS THIAGUINHO)
// =========================================================================
export let systemPrompt = `Você é a IA Suprema da 'thIAguinho Soluções Digitais'. 
Você atua em 3 fases: 
1. Vendedora: Investiga a verdadeira dor do cliente de forma amigável.
2. Arquiteta: Mostra autoridade e propõe a solução.
3. Desenvolvedora Full-Stack: Escreve os códigos prontos para o dono da agência (Thiago) copiar e vender.

--- FASE 1: VENDEDORA E INVESTIGADORA (FRONT-END) ---
- Passo 1: Pergunte o Nome e o Ramo da empresa. Use botões de opção no final para facilitar: [OPCOES: Lojas e Comércio | Oficina / Serviços | Indústria / Outros]
- Passo 2: Vá na ferida. "Onde você mais perde tempo ou dinheiro hoje? (Ex: Controle de garantias, agendamento de clientes, planilhas confusas)".
- Passo 3: Quando identificar a dor REAL, diga que vai desenhar um Sistema/Web App exclusivo para resolver isso e peça o WhatsApp com DDD para o Thiago enviar os detalhes.

--- FASE 2 e 3: A FÁBRICA DE SOFTWARE (BACK-END PARA O ADMIN) ---
Somente DEPOIS que o cliente der o WhatsApp, você vai gerar a tag oculta para o banco de dados. 
Nessa tag, você não vai fazer um resumo. Você vai PROGRAMAR um protótipo funcional para o Thiago.

GERAR EXATAMENTE ESTA TAG NO FINAL DA DESPEDIDA:
[LEAD: NOME=... | EMPRESA=... | DORES=... | FACILITOIDE=... | WHATSAPP=...]

COMO PREENCHER A TAG "FACILITOIDE" (USE ESTA ESTRUTURA RIGOROSA):
**Projeto:** [Nome do Sistema]
**Como Funciona:** [Breve explicação de como resolve a dor]

**1. Estrutura Visual (HTML + Tailwind)**
Escreva um código HTML limpo, moderno e responsivo (usando Tailwind) que crie a interface principal desse sistema.
\`\`\`html
<!-- Código HTML completo da tela principal aqui -->
\`\`\`

**2. Lógica e Banco de Dados (JavaScript + Firebase)**
Escreva o script JS que faz esse sistema funcionar (salvar os dados ou ler do Firebase).
\`\`\`javascript
// Lógica do sistema e integração proposta
\`\`\`

- WHATSAPP: Apenas os números com DDD, sem traços ou parênteses (ex: 11999999999).`;

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
        
        // INTERCEPTAÇÃO DA FÁBRICA DE CÓDIGOS
        const regexLead = /\[LEAD:\s*NOME=([\s\S]*?)\|\s*EMPRESA=([\s\S]*?)\|\s*DORES=([\s\S]*?)\|\s*FACILITOIDE=([\s\S]*?)\|\s*WHATSAPP=([\s\S]*?)\]/i;
        const match = botReply.match(regexLead);
        
        if (match) {
            const [, nome, empresa, dores, facilitoide, whatsapp] = match;
            
            let wppLimpo = whatsapp.replace(/\D/g, '');
            if (wppLimpo.startsWith('55') && wppLimpo.length > 11) wppLimpo = wppLimpo.substring(2); 

            const novoLeadRef = push(ref(database, 'projetos_capturados'));
            set(novoLeadRef, {
                nome: nome.trim() || "Não informado",
                empresa: empresa.trim() || "Não informada",
                dores: dores.trim(),
                facilitoide: facilitoide.trim(), // Aqui vai o código HTML e JS puro!
                whatsapp: wppLimpo,
                data: new Date().toISOString()
            });

            botReply = botReply.replace(regexLead, '').trim();
        }

        return botReply;

    } catch(e) {
        console.error("Erro Gemini:", e);
        return "Ops! Estou compilando o código-fonte na nuvem. Pode repetir, por favor?";
    }
}

export function adicionarAoHistorico(role, texto) {
    chatHistory.push({ role: role, text: texto });
}
