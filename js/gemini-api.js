// NOME DO ARQUIVO: gemini-api.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { database, ref, push, set, get } from './firebase-config.js';

let chatHistoryCliente = [];
let chaveApiArmazenada = null; 

// =========================================================================
// CÉREBRO 1: A VENDEDORA E ARQUITETA (BLINDADA CONTRA VAZAMENTOS)
// =========================================================================
export let systemPrompt = `Você é a IA central da 'thIAguinho Soluções Digitais'. Você tem 2 funções: Vendedora Empática e Arquiteta Sênior.

MUITO IMPORTANTE - COMO CONVERSAR COM O CLIENTE:
- Seja natural, cordial e aja como humano.
- Faça APENAS UMA PERGUNTA por vez. Converse passo a passo.
- NUNCA envie códigos, tags ou a palavra [LEAD] para o cliente ler ou preencher. É VOCÊ quem vai gerar a tag secretamente na sua mente no final.
- Gere SEMPRE botões de opções com o TEXTO COMPLETO (Ex: [OPCOES: Soluções para Empresa | Rotina Pessoal]). NUNCA use "A" ou "B".

PASSO A PASSO DA CONVERSA:
1. Pergunte o NOME do cliente e o que ele busca (Empresa ou Pessoal).
2. Investigue qual a maior DOR ou problema de gestão que ele enfrenta hoje.
3. Diga que a thIAguinho é especialista nisso, que vai desenhar um modelo técnico (sistema) para resolver isso e peça o número de WhatsApp dele (com DDD).
4. APENAS quando ele informar o WhatsApp, despeça-se educadamente. 
5. NESTA ÚLTIMA MENSAGEM DE DESPEDIDA, você OBRIGATORIAMENTE deve adicionar no final do seu texto a TAG SECRETA abaixo.

COMO GERAR A TAG (INSTRUÇÃO SECRETA SÓ PARA VOCÊ E PARA O SISTEMA):
No final da sua última mensagem, cole exatamente esta estrutura preenchida:
[LEAD: NOME=nome do cliente | EMPRESA=nome da empresa ou pessoal | DORES=resumo detalhado da dor | FACILITOIDE=arquitetura do sistema | WHATSAPP=apenas numeros]

COMO PREENCHER O "FACILITOIDE" DENTRO DA TAG:
Escreva em Markdown a solução técnica que você pensou. Ex:
**Projeto:** [Nome do App]
**Lógica:** [Como funciona na prática]
**Stack Técnico:** HTML, JS, Tailwind, Firebase.`;

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
    } catch (e) { console.error("Erro Firebase:", e); }
    return null;
}

export async function askGemini(msgUsuario) {
    try {
        const apiKey = await obterChaveDaApi();
        if (!apiKey) return "Aviso: Chave da API não configurada.";

        const MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const contents = chatHistoryCliente.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
        contents.push({ role: 'user', parts: [{ text: msgUsuario }] });

        const res = await fetch(MODEL_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: contents, systemInstruction: { parts: [{ text: systemPrompt }] } })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        
        let botReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro.";
        
        // O código invisível que extrai a tag da mente da IA sem mostrar pro cliente
        const regexLead = /\[LEAD:\s*NOME=([\s\S]*?)\|\s*EMPRESA=([\s\S]*?)\|\s*DORES=([\s\S]*?)\|\s*FACILITOIDE=([\s\S]*?)\|\s*WHATSAPP=([\s\S]*?)\]/i;
        const match = botReply.match(regexLead);
        
        if (match) {
            const [, nome, empresa, dores, facilitoide, whatsapp] = match;
            let wppLimpo = whatsapp.replace(/\D/g, '');
            if (wppLimpo.startsWith('55') && wppLimpo.length > 11) wppLimpo = wppLimpo.substring(2); 

            const novoLeadRef = push(ref(database, 'projetos_capturados'));
            set(novoLeadRef, {
                nome: nome.trim() || "Não informado", empresa: empresa.trim() || "Não informada",
                dores: dores.trim(), facilitoide: facilitoide.trim(), whatsapp: wppLimpo, data: new Date().toISOString(), devChat: []
            });
            // Apaga a Tag da mensagem visual para o cliente nunca ver
            botReply = botReply.replace(regexLead, '').trim();
        }
        return botReply;
    } catch(e) { return "Erro no servidor neural. Pode repetir?"; }
}

export function adicionarAoHistorico(role, texto) {
    chatHistoryCliente.push({ role: role, text: texto });
}

// =========================================================================
// CÉREBRO 2: O DESENVOLVEDOR DA FÁBRICA (LÊ SEUS ARQUIVOS)
// =========================================================================
export async function conversarComDesenvolvedorIA(msgAdmin, contextoProjeto, historicoSalvo = []) {
    try {
        const apiKey = await obterChaveDaApi();
        if (!apiKey) return "Coloque a chave da API nas configurações do Painel.";

        const promptDesenvolvedor = `Você é um Engenheiro de Software Sênior trabalhando para o Thiago (Dono da Agência thIAguinho Soluções).
        Stack oficial: HTML, JS, Tailwind, Firebase e Cloudinary.
        Projeto atual: ${contextoProjeto}
        
        REGRA MÁXIMA DE COMUNICAÇÃO:
        A tela do painel do Thiago é limitada. Portanto, SEMPRE que você for gerar os códigos e a resposta, siga ESTA ESTRUTURA RIGOROSA:
        1. Comece a sua resposta conversando com o Thiago de forma direta.
        2. Diga EXATAMENTE os nomes dos arquivos que você está gerando (Ex: "Thiago, estou te enviando estes 2 arquivos: index.html e script.js").
        3. Só depois envie os blocos de código formatados em Markdown (\`\`\`html, \`\`\`javascript).
        
        ANÁLISE DE ARQUIVOS (MUITO IMPORTANTE):
        Se o Thiago enviar o conteúdo de códigos fontes antigos (ex: um sistema de oficina), leia a estrutura dele, mantenha o que for bom, e evolua o código para resolver a "Dor Real" do novo cliente. Entregue a solução completa.`;

        const MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const contents = historicoSalvo.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
        contents.push({ role: 'user', parts: [{ text: msgAdmin }] });

        const res = await fetch(MODEL_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: contents, systemInstruction: { parts: [{ text: promptDesenvolvedor }] } })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro de processamento.";

    } catch(e) {
        return "Erro de compilação na IA: " + e.message;
    }
}