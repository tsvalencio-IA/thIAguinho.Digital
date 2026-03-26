// NOME DO ARQUIVO: gemini-api.js
// LOCALIZAÇÃO: Dentro da pasta 'js'

import { database, ref, push, set, get } from './firebase-config.js';

let chatHistoryCliente = [];
let chaveApiArmazenada = null; 

// A BLINDAGEM MESTRA CONTRA DUPLICAÇÃO NO BANCO DE DADOS
let leadJaCapturado = false;

// =========================================================================
// CÉREBRO 1: A VENDEDORA E ARQUITETA
// =========================================================================
export let systemPrompt = `Você é o Arquiteto da 'thIAguinho Soluções'. Sua missão é entrevistar o cliente e descobrir suas dores corporativas.

REGRA ABSOLUTA DOS BOTÕES:
Finalize TODAS as suas mensagens com opções clicáveis OBRIGATÓRIAS.
Formato exato: [OPCOES: Resposta completa 1 | Resposta completa 2]. NUNCA use "A" ou "B". NUNCA esqueça os botões.

FLUXO DA CONVERSA:
PASSO 1: Pergunte o nome e se quer sistema para Empresa ou Pessoal. (Use botão [OPCOES: ...])
PASSO 2: Investigue a DOR principal. (Use botão [OPCOES: ...])
PASSO 3: Diga: "Vou desenhar a arquitetura técnica. Por favor, digite seu WhatsApp com DDD."
PASSO 4: QUANDO RECEBER O WHATSAPP, agradeça e despeça-se gerando a tag secreta no final do texto.

REGRA DE ENCERRAMENTO (MUITO IMPORTANTE):
Depois que o cliente fornecer o WhatsApp e você gerar a Tag secreta, a entrevista ACABA.
Se a cliente continuar puxando assunto, tagarelando ou mandando mensagens extras, NÃO FAÇA MAIS PERGUNTAS. NÃO PEÇA MAIS DETALHES. Apenas responda com simpatia: "Tudo anotado! Nosso especialista Thiago entrará em contato com você em breve com a solução!"

SEGREDO DA TAG (GERAR APENAS NO PASSO 4, UMA ÚNICA VEZ):
[LEAD: NOME=nome do cliente | EMPRESA=tipo de negócio | DORES=resumo da dor | FACILITOIDE=arquitetura do sistema proposta | WHATSAPP=apenas numeros]`;

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
        if (!apiKey) return "Aviso: Chave da API não configurada no painel.";

        const MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const contents = chatHistoryCliente.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
        contents.push({ role: 'user', parts: [{ text: msgUsuario }] });

        const res = await fetch(MODEL_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: contents, systemInstruction: { parts: [{ text: systemPrompt }] } })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        
        let botReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, ocorreu um erro de processamento.";
        
        const regexLead = /\[LEAD:\s*NOME=([\s\S]*?)\|\s*EMPRESA=([\s\S]*?)\|\s*DORES=([\s\S]*?)\|\s*FACILITOIDE=([\s\S]*?)\|\s*WHATSAPP=([\s\S]*?)\]/i;
        const match = botReply.match(regexLead);
        
        if (match) {
            // AQUI ESTÁ A BLINDAGEM: Só salva se não tiver salvo antes nesta sessão
            if (!leadJaCapturado) {
                const [, nome, empresa, dores, facilitoide, whatsapp] = match;
                let wppLimpo = whatsapp.replace(/\D/g, '');
                if (wppLimpo.startsWith('55') && wppLimpo.length > 11) wppLimpo = wppLimpo.substring(2); 

                const novoLeadRef = push(ref(database, 'projetos_capturados'));
                set(novoLeadRef, {
                    nome: nome.trim() || "Cliente Indefinido", 
                    empresa: empresa.trim() || "Não informada",
                    dores: dores.trim() || "Sem dor detalhada", 
                    facilitoide: facilitoide.trim() || "Arquitetura pendente.", 
                    whatsapp: wppLimpo, 
                    data: new Date().toISOString(), 
                    devChat: [],
                    status: 'novo'
                });
                leadJaCapturado = true; // Trava a sessão, não salva mais nenhum cliente deste chat
            }
            botReply = botReply.replace(regexLead, '').trim();
        } else if (leadJaCapturado) {
            // Se a IA alucinar e tentar gerar de novo de forma torta, a gente apaga por segurança
            botReply = botReply.replace(/\[LEAD:.*?\]/gi, '').trim();
        }
        return botReply;
    } catch(e) { return "Houve uma falha na conexão. Pode repetir a informação?"; }
}

export function adicionarAoHistorico(role, texto) {
    chatHistoryCliente.push({ role: role, text: texto });
}

// =========================================================================
// CÉREBRO 2: O ENGENHEIRO SAAS (INJETOR DO TRIAL DE 5 USOS)
// =========================================================================
export async function conversarComDesenvolvedorIA(msgAdmin, contextoProjeto, historicoSalvo = [], idProjetoAtivo = "padrao") {
    try {
        const apiKey = await obterChaveDaApi();
        if (!apiKey) return "Configure a chave da API no Painel primeiro.";

        const promptDesenvolvedor = `Você é um Engenheiro de Software Sênior construindo sistemas SaaS para a thIAguinho Soluções.
        Projeto atual: ${contextoProjeto}
        ID ÚNICO do Cliente: ${idProjetoAtivo}
        
        Sempre coloque os códigos gerados em blocos Markdown puros (ex: \`\`\`html).

        DIRETRIZ MÁXIMA PARA SISTEMAS DE DEMONSTRAÇÃO:
        Toda vez que o Thiago pedir a você para gerar um arquivo HTML completo do sistema para o cliente testar, você DEVE OBRIGATORIAMENTE injetar 2 funcionalidades lógicas no código JavaScript daquele HTML:
        
        1. BLOQUEIO DE 5 USOS REAIS (Trial Inteligente):
        - A contagem DEVE começar em 0 (zero). Se a variável no localStorage não existir, defina-a como 0. Nunca comece a tela bloqueada.
        - Crie uma função lógica no sistema que conte "ações completas de valor" feitas pelo cliente. (Por exemplo: se você criar um checklist, some +1 apenas quando o cliente clicar no botão de "Salvar" ou "Adicionar" item. Não conte simples cliques na tela).
        - Salve essa contagem no localStorage ('thiaguinho_trial_uses').
        - APENAS quando a contagem for MAIOR OU IGUAL a 5 usos, bloqueie toda a interface do sistema (injete uma div preta com z-index altíssimo) e exiba a mensagem: "Atenção: A sua versão de demonstração expirou. Entre em contato com a thIAguinho Soluções para adquirir o sistema completo." Não permita que ele feche essa mensagem.
        
        2. CHAT REVERSO (FEEDBACK DIRETO PARA O THIAGO):
        - Adicione um botão flutuante e chamativo no HTML (ex: "Gostou? Fale com o Thiago").
        - Ao clicar, ele deve abrir um pequeno formulário de texto para o cliente digitar.
        - Quando o cliente enviar, OBRIGATORIAMENTE faça um fetch usando a API REST do Firebase para enviar essa mensagem para o Thiago em tempo real.
        - URL EXATA DO FETCH: https://thiaguinho-40a14-default-rtdb.firebaseio.com/projetos_capturados/${idProjetoAtivo}/feedbacks.json
        - Exemplo do código do fetch que você deve gerar no HTML do cliente:
          fetch('https://thiaguinho-40a14-default-rtdb.firebaseio.com/projetos_capturados/${idProjetoAtivo}/feedbacks.json', { method: 'POST', body: JSON.stringify({ texto: mensagem_do_cliente, data: new Date().toISOString() }) })
        - Dê um alert("Mensagem enviada com sucesso ao Thiago!") e feche o form.

        Comece sua resposta avisando o Thiago que o código está blindado com o Trial de 5 usos e integrado ao Firebase dele.`;

        const MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const contents = historicoSalvo.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
        contents.push({ role: 'user', parts: [{ text: msgAdmin }] });

        const res = await fetch(MODEL_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: contents, systemInstruction: { parts: [{ text: promptDesenvolvedor }] } })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro de processamento da IA.";

    } catch(e) {
        return "Erro de compilação da IA: " + e.message;
    }
}