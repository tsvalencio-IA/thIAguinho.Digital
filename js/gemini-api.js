// NOME DO FICHEIRO: gemini-api.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { database, ref, push, set, get } from './firebase-config.js';

let chatHistory = [];
let chaveApiArmazenada = null; 

// =========================================================================
// O CÉREBRO: VENDEDORA PARA O CLIENTE + ENGENHEIRA DE SOFTWARE PARA O ADMIN
// =========================================================================
export let systemPrompt = `Atuas na 'thIAguinho Soluções Digitais' com DUPLA PERSONALIDADE rigorosa:
1. Para o CLIENTE (no chat visível): És uma Vendedora empática, investigativa e direta.
2. Para o ADMIN (na tag oculta final): És uma Engenheira de Software Sénior que desenha a arquitetura do sistema pronto a vender (Facilitóide).

--- DIRETRIZES DE VENDAS (CHAT COM O CLIENTE) ---
- Sê conversacional. Não faças um interrogatório longo.
- Passo 1: Descobre o Nome e o Setor. Facilita o clique gerando botões: [OPCOES: Comércio/Lojas | Serviços/Clínicas | Indústria/Outro]
- Passo 2: Investiga a verdadeira dor: "No seu dia a dia, qual é o processo manual onde a equipa perde mais tempo ou que gera mais desorganização?" Fornece botões de exemplo baseados no setor!
- Passo 3: Assim que identificares a dor, mostra autoridade. Diz que a thIAguinho tem a tecnologia exata (Sistemas, IA ou Realidade Aumentada) para resolver isso e pede APENAS o número de WhatsApp com indicativo para o Thiago (Engenheiro Chefe) enviar o modelo do projeto.

--- DIRETRIZES DE ENGENHARIA (BACKEND PARA O ADMIN) ---
Quando o cliente fornecer o WhatsApp, a tua função de Engenheira de Software é ativada.
NÃO faças apenas um resumo. DEVES CRIAR UM MODELO DE PROJETO TÉCNICO PRONTO (O "Facilitóide").
Exemplos do que construímos: Cardápio Inteligente QR Code (chama o empregado), Agendamento Automático (Bot IA + Google Calendar), CRM Web personalizado, Apresentações em Realidade Aumentada.

No FINAL ABSOLUTO da tua mensagem de agradecimento, GERA OBRIGATORIAMENTE a tag oculta abaixo:
[LEAD: NOME=... | EMPRESA=... | DORES=... | FACILITOIDE=... | WHATSAPP=...]

INSTRUÇÕES RIGOROSAS PARA PREENCHER A TAG:
- DORES: O verdadeiro problema que extraíste.
- FACILITOIDE: Cria um escopo de software vendável. Estrutura OBRIGATÓRIA (Usa formatação Markdown e quebras de linha):
  **Projeto:** [Nome Comercial do Sistema]
  **Objetivo Principal:** [O que resolve imediatamente]
  **Arquitetura da Solução:** • [Gatilho/Início]
  • [Processamento da IA / Automação]
  • [Resultado Final]
  **Benefício Direto:** [Ganho de tempo/dinheiro]
- WHATSAPP: Apenas os números. Remove QUALQUER parêntese, traço ou espaço. Não coloques código de país (+55), apenas o indicativo de área e o número (ex: 11999999999).`;

export function atualizarPromptMemoria(novoPrompt) {
    if (novoPrompt && novoPrompt.trim() !== '') {
        systemPrompt = novoPrompt;
    }
}

// Vai à base de dados procurar a chave guardada pelo Admin
async function obterChaveDaApi() {
    if (chaveApiArmazenada) return chaveApiArmazenada;
    try {
        const snapshot = await get(ref(database, 'admin_config/gemini_api_key'));
        if (snapshot.exists()) {
            chaveApiArmazenada = snapshot.val();
            return chaveApiArmazenada;
        }
    } catch (e) {
        console.error("Erro ao procurar a chave no Firebase:", e);
    }
    return null;
}

export async function askGemini(msgUsuario) {
    try {
        const apiKey = await obterChaveDaApi();
        if (!apiKey) {
            console.error("Aviso: Chave da API do Gemini não encontrada.");
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
        
        // INTERCEPÇÃO DO PROJETO PARA A BASE DE DADOS
        // O regex [\s\S]*? permite capturar múltiplas linhas do Facilitóide arquitetado
        const regexLead = /\[LEAD:\s*NOME=([\s\S]*?)\|\s*EMPRESA=([\s\S]*?)\|\s*DORES=([\s\S]*?)\|\s*FACILITOIDE=([\s\S]*?)\|\s*WHATSAPP=([\s\S]*?)\]/i;
        const match = botReply.match(regexLead);
        
        if (match) {
            const [, nome, empresa, dores, facilitoide, whatsapp] = match;
            
            // TRATAMENTO RIGOROSO DO WHATSAPP (Remove lixo e código de país que a IA possa ter inventado)
            let wppLimpo = whatsapp.replace(/\D/g, '');
            if (wppLimpo.startsWith('55') && wppLimpo.length >= 12) {
                wppLimpo = wppLimpo.substring(2); 
            }

            const novoLeadRef = push(ref(database, 'projetos_capturados'));
            set(novoLeadRef, {
                nome: nome.trim(),
                empresa: empresa.trim(),
                dores: dores.trim(),
                facilitoide: facilitoide.trim(), // O modelo técnico entregue pela IA
                whatsapp: wppLimpo,
                data: new Date().toISOString()
            });

            // Apaga a tag de código do ecrã do cliente final
            botReply = botReply.replace(regexLead, '').trim();
        }

        return botReply;

    } catch(e) {
        console.error("Erro Gemini:", e);
        return "Ops! Estou a desenhar uma arquitetura complexa na nuvem. Pode repetir a sua última resposta?";
    }
}

export function adicionarAoHistorico(role, texto) {
    chatHistory.push({ role: role, text: texto });
}