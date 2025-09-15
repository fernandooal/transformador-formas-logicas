// Configuração do MathJax
window.MathJax = {
    tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']]
    },
    svg: {
        fontCache: 'global'
    }
};

// Classes para representar a estrutura lógica
class Formula {
    constructor(type, content, left = null, right = null) {
        this.type = type; // 'atom', 'neg', 'and', 'or', 'imp', 'iff', 'forall', 'exists'
        this.content = content;
        this.left = left;
        this.right = right;
    }

    toString() {
        switch(this.type) {
            case 'atom': return this.content;
            case 'neg': return `\\neg ${this.left.toString()}`;
            case 'and': return `(${this.left.toString()} \\land ${this.right.toString()})`;
            case 'or': return `(${this.left.toString()} \\lor ${this.right.toString()})`;
            case 'imp': return `(${this.left.toString()} \\rightarrow ${this.right.toString()})`;
            case 'iff': return `(${this.left.toString()} \\leftrightarrow ${this.right.toString()})`;
            case 'forall': return `\\forall ${this.content} ${this.left.toString()}`;
            case 'exists': return `\\exists ${this.content} ${this.left.toString()}`;
            default: return this.content;
        }
    }
}

class FormulaParser {
    constructor(input) {
        this.input = input.trim();
        this.pos = 0;
    }

    parse() {
        this.skipWhitespace();
        const f = this.parseExpression();
        this.skipWhitespace();
        if (this.pos < this.input.length) {
            throw new Error(`Token inesperado na posição ${this.pos}`);
        }
        return f;
    }

    parseExpression() {
        return this.parseImplication();
    }

    parseImplication() {
        let left = this.parseDisjunction();
        while (this.peek('\\rightarrow') || this.peek('\\to') || this.peek('\\leftrightarrow') || this.peek('\\iff')) {
            if (this.peek('\\rightarrow') || this.peek('\\to')) {
                this.consume(this.peek('\\rightarrow') ? '\\rightarrow' : '\\to');
                const right = this.parseDisjunction();
                left = new Formula('imp', null, left, right);
            } else {
                this.consume(this.peek('\\leftrightarrow') ? '\\leftrightarrow' : '\\iff');
                const right = this.parseDisjunction();
                left = new Formula('iff', null, left, right);
            }
        }
        return left;
    }

    parseDisjunction() {
        let left = this.parseConjunction();
        while (this.peek('\\lor') || this.peek('\\vee')) {
            this.consume(this.peek('\\lor') ? '\\lor' : '\\vee');
            const right = this.parseConjunction();
            left = new Formula('or', null, left, right);
        }
        return left;
    }

    parseConjunction() {
        let left = this.parseNegation();
        while (this.peek('\\land') || this.peek('\\wedge')) {
            this.consume(this.peek('\\land') ? '\\land' : '\\wedge');
            const right = this.parseNegation();
            left = new Formula('and', null, left, right);
        }
        return left;
    }

    parseNegation() {
        this.skipWhitespace();
        if (this.peek('\\neg') || this.peek('\\lnot')) {
            this.consume(this.peek('\\neg') ? '\\neg' : '\\lnot');
            this.skipWhitespace();
            const sub = this.parseNegation();
            return new Formula('neg', null, sub);
        }
        return this.parsePrimary();
    }

    parsePrimary() {
        this.skipWhitespace();

        // Quantificadores em qualquer posição
        if (this.peek('\\forall') || this.peek('\\exists')) {
            const quantifier = this.peek('\\forall') ? 'forall' : 'exists';
            this.consume(quantifier === 'forall' ? '\\forall' : '\\exists');
            this.skipWhitespace();
            const variable = this.parseVariable();
            this.skipWhitespace();
            const body = this.parseExpression();
            return new Formula(quantifier, variable, body);
        }

        if (this.peek('(')) {
            this.consume('(');
            const inside = this.parseExpression();
            this.skipWhitespace();
            this.consume(')');
            return inside;
        }

        return this.parseAtom();
    }

    parseAtom() {
        this.skipWhitespace();
        const name = this.parseIdentifier();
        if (!name) throw new Error('Átomo esperado');

        // Átomo com argumentos
        if (this.peek('(')) {
            this.consume('(');
            const args = [];
            while (!this.peek(')')) {
                this.skipWhitespace();
                args.push(this.parseTerm());
                this.skipWhitespace();
                if (this.peek(',')) this.consume(',');
                this.skipWhitespace();
            }
            this.consume(')');
            return new Formula('atom', `${name}(${args.join(',')})`);
        }

        return new Formula('atom', name);
    }

    parseTerm() {
        this.skipWhitespace();
        const id = this.parseIdentifier();
        if (!id) throw new Error('Termo esperado');

        if (this.peek('(')) {
            this.consume('(');
            const args = [];
            while (!this.peek(')')) {
                this.skipWhitespace();
                args.push(this.parseTerm());
                this.skipWhitespace();
                if (this.peek(',')) this.consume(',');
                this.skipWhitespace();
            }
            this.consume(')');
            return `${id}(${args.join(',')})`;
        }

        return id;
    }

    parseIdentifier() {
        this.skipWhitespace();
        let start = this.pos;
        while (this.pos < this.input.length && /[A-Za-z0-9_]/.test(this.input[this.pos])) this.pos++;
        if (this.pos === start) return null;
        return this.input.slice(start, this.pos);
    }

    parseVariable() {
        const v = this.parseIdentifier();
        if (!v) throw new Error('Variável esperada');
        return v;
    }

    // Adaptação do peek para ignorar '\' e espaços finos '\,'
    peek(expected) {
        this.skipWhitespace();
        let len = expected.length;
        let substr = this.input.substr(this.pos, len);

        // remover barras invertidas do LaTeX
        const clean = s => s.replace(/\\/g, '');
        return clean(substr) === clean(expected);
    }

    consume(expected) {
        this.skipWhitespace();
        let len = expected.length;
        let substr = this.input.substr(this.pos, len);

        const clean = s => s.replace(/\\/g, '');
        if (clean(substr) === clean(expected)) {
            this.pos += len;
        } else {
            throw new Error(`Esperado '${expected}' na posição ${this.pos}`);
        }
    }

    skipWhitespace() {
        while (this.pos < this.input.length && (/\s/.test(this.input[this.pos]) || (this.input[this.pos] === '\\' && this.input.substr(this.pos, 2) === '\\,'))) {
            // se for '\,' pula 2 posições
            if (this.input.substr(this.pos, 2) === '\\,') this.pos += 2;
            else this.pos++;
        }
    }    
}

// Transformador de fórmulas
class FormulaTransformer {
    constructor(formula) {
        this.formula = formula;
        this.steps = [];
    }

    eliminateImplications(formula) {
        const steps = [];
        const transform = (f) => {
            switch(f.type) {
                case 'imp':
                    const impResult = new Formula('or', null, 
                        new Formula('neg', null, transform(f.left)), 
                        transform(f.right)
                    );
                    steps.push(`Substituímos a implicação: $$${f.toString()} \\equiv ${impResult.toString()}$$`);
                    return impResult;
                case 'iff':
                    const iffResult = new Formula('and', null,
                        new Formula('or', null, new Formula('neg', null, transform(f.left)), transform(f.right)),
                        new Formula('or', null, new Formula('neg', null, transform(f.right)), transform(f.left))
                    );
                    steps.push(`Substituímos o bicondicional: $$${f.toString()} \\equiv ${iffResult.toString()}$$`);
                    return iffResult;
                case 'and':
                case 'or':
                    return new Formula(f.type, f.content, transform(f.left), transform(f.right));
                case 'neg':
                    return new Formula('neg', f.content, transform(f.left));
                case 'forall':
                case 'exists':
                    return new Formula(f.type, f.content, transform(f.left));
                default:
                    return f;
            }
        };
        const result = transform(formula);
        return { formula: result, steps };
    }

    pushNegations(formula) {
        const steps = [];
        const transform = (f) => {
            switch(f.type) {
                case 'neg':
                    if (f.left.type === 'neg') {
                        const result = transform(f.left.left);
                        steps.push(`Eliminamos a negação dupla: $$\\neg \\neg ${f.left.left.toString()} \\equiv ${result.toString()}$$`);
                        return result;
                    } else if (f.left.type === 'and') {
                        const result = new Formula('or', null,
                            transform(new Formula('neg', null, f.left.left)),
                            transform(new Formula('neg', null, f.left.right))
                        );
                        steps.push(`Aplicamos De Morgan: $$\\neg (${f.left.left.toString()} \\land ${f.left.right.toString()}) \\equiv ${result.toString()}$$`);
                        return result;
                    } else if (f.left.type === 'or') {
                        const result = new Formula('and', null,
                            transform(new Formula('neg', null, f.left.left)),
                            transform(new Formula('neg', null, f.left.right))
                        );
                        steps.push(`Aplicamos De Morgan: $$\\neg (${f.left.left.toString()} \\lor ${f.left.right.toString()}) \\equiv ${result.toString()}$$`);
                        return result;
                    } else if (f.left.type === 'forall') {
                        const result = new Formulza('exists', f.left.content, transform(new Formula('neg', null, f.left.left)));
                        steps.push(`Negação de quantificador universal: $$\\neg \\forall ${f.left.content} ${f.left.left.toString()} \\equiv ${result.toString()}$$`);
                        return result;
                    } else if (f.left.type === 'exists') {
                        const result = new Formula('forall', f.left.content, transform(new Formula('neg', null, f.left.left)));
                        steps.push(`Negação de quantificador existencial: $$\\neg \\exists ${f.left.content} ${f.left.left.toString()} \\equiv ${result.toString()}$$`);
                        return result;
                    }
                    return new Formula('neg', f.content, transform(f.left));
                case 'and':
                case 'or':
                    return new Formula(f.type, f.content, transform(f.left), transform(f.right));
                case 'forall':
                case 'exists':
                    return new Formula(f.type, f.content, transform(f.left));
                default:
                    return f;
            }
        };
        const result = transform(formula);
        return { formula: result, steps };
    }

    standardizeVariables(formula, used = new Set(), mapping = {}, steps = []) {
        if (formula.type === 'forall' || formula.type === 'exists') {
            // Renomeia a variável se já foi usada
            let newVar = formula.content;
            if (used.has(newVar)) {
                let i = 1;
                while (used.has(newVar + i)) i++;
                newVar = newVar + i;
                steps.push(`Renomeamos a variável ligada ${formula.content} para ${newVar}`);
            }
            used.add(newVar);
            mapping[formula.content] = newVar;
    
            // Recursivamente dentro do escopo
            const inner = this.standardizeVariables(formula.left, new Set(used), { ...mapping }, steps);
            return { formula: new Formula(formula.type, newVar, inner.formula), steps };
        } 
        else if (formula.type === 'atom') {
            // Substitui variáveis dentro do átomo
            let name = formula.content;
            Object.keys(mapping).forEach(v => {
                if (name.includes(v)) {
                    steps.push(`Substituímos ${v} por ${mapping[v]} em ${name}`);
                    name = name.replace(new RegExp(`\\b${v}\\b`, "g"), mapping[v]);
                }
            });
            return { formula: new Formula('atom', name), steps };
        } 
        else if (formula.type === 'neg') {
            const inner = this.standardizeVariables(formula.left, new Set(used), { ...mapping }, steps);
            return { formula: new Formula('neg', null, inner.formula), steps };
        } 
        else if (['and', 'or', 'imp', 'iff'].includes(formula.type)) {
            const left = this.standardizeVariables(formula.left, new Set(used), { ...mapping }, steps);
            const right = this.standardizeVariables(formula.right, new Set(used), { ...mapping }, steps);
            return { formula: new Formula(formula.type, null, left.formula, right.formula), steps };
        } 
        else {
            return { formula, steps };
        }
    }
      

    toPrenexForm(formula) {
        const steps = [];
        const quantifiers = [];
        const extractQuantifiers = (f) => {
            switch(f.type) {
                case 'forall':
                case 'exists':
                    quantifiers.push({ type: f.type, variable: f.content });
                    return extractQuantifiers(f.left);
                case 'and':
                case 'or':
                    return new Formula(f.type, f.content, extractQuantifiers(f.left), extractQuantifiers(f.right));
                case 'neg':
                    return new Formula('neg', f.content, extractQuantifiers(f.left));
                default:
                    return f;
            }
        };
        const matrix = extractQuantifiers(formula);
        let result = matrix;
        for (let i = quantifiers.length - 1; i >= 0; i--) {
            const q = quantifiers[i];
            result = new Formula(q.type, q.variable, result);
        }
        if (quantifiers.length > 0) steps.push(`Movemos os quantificadores para frente: $$${result.toString()}$$`);
        return { formula: result, steps };
    }

    skolemize(formula) {
        const steps = [];
        let skolemCounter = 1;
    
        const skolemizeRec = (f, universals) => {
            switch(f.type) {
                case 'exists':
                    // Cria função de Skolem dependendo das variáveis universais atuais
                    const skolemFunc = universals.length > 0 
                        ? `f${skolemCounter++}(${universals.join(',')})` 
                        : `c${skolemCounter++}`;
                    steps.push(`$\\exists ${f.content}$ substituído por $${skolemFunc}$`);
                    return skolemizeRec(this.substitute(f.left, f.content, skolemFunc), universals);
                case 'forall':
                    return new Formula('forall', f.content, skolemizeRec(f.left, [...universals, f.content]));
                case 'and':
                case 'or':
                    return new Formula(f.type, f.content, skolemizeRec(f.left, universals), skolemizeRec(f.right, universals));
                case 'neg':
                    return new Formula('neg', f.content, skolemizeRec(f.left, universals));
                default:
                    return f;
            }
        };
    
        const result = skolemizeRec(formula, []);
        return { formula: result, steps };
    }
    
    // Substitui uma variável por termo (função de Skolem ou constante)
    substitute(formula, variable, term) {
        switch(formula.type) {
            case 'atom':
                // Substitui todas as ocorrências da variável
                const regex = new RegExp(`\\b${variable}\\b`, 'g');
                return new Formula('atom', formula.content.replace(regex, term));
            case 'neg':
                return new Formula('neg', formula.content, this.substitute(formula.left, variable, term));
            case 'and':
            case 'or':
            case 'imp':
            case 'iff':
                return new Formula(formula.type, formula.content, this.substitute(formula.left, variable, term), this.substitute(formula.right, variable, term));
            case 'forall':
            case 'exists':
                // Se a variável é quantificada aqui, não substitui dentro
                if (formula.content === variable) return formula;
                return new Formula(formula.type, formula.content, this.substitute(formula.left, variable, term));
            default:
                return formula;
        }
    }

    toCNF(formula) {
        const steps = [];
        const distribute = (f) => {
            if (f.type === 'or' && (f.left.type === 'and' || f.right.type === 'and')) {
                if (f.left.type === 'and') {
                    const result = new Formula('and', null,
                        distribute(new Formula('or', null, f.left.left, f.right)),
                        distribute(new Formula('or', null, f.left.right, f.right))
                    );
                    steps.push(`Distribuímos OR sobre AND: $$${f.toString()} \\equiv ${result.toString()}$$`);
                    return result;
                } else {
                    const result = new Formula('and', null,
                        distribute(new Formula('or', null, f.left, f.right.left)),
                        distribute(new Formula('or', null, f.left, f.right.right))
                    );
                    steps.push(`Distribuímos OR sobre AND: $$${f.toString()} \\equiv ${result.toString()}$$`);
                    return result;
                }
            }
            switch(f.type) {
                case 'and':
                case 'or':
                    return new Formula(f.type, f.content, distribute(f.left), distribute(f.right));
                case 'neg':
                    return new Formula('neg', f.content, distribute(f.left));
                case 'forall':
                case 'exists':
                    return new Formula(f.type, f.content, distribute(f.left));
                default:
                    return f;
            }
        };
        const result = distribute(formula);
        steps.push(`Forma Normal Conjuntiva final: $$${result.toString()}$$`);
        return { formula: result, steps };
    }

    transform() {
        let current = this.formula;
        let allSteps = [];
    
        // 0 - Fórmula original
        allSteps.push({ title: "Fórmula original", formula: current, steps: [] });
    
        // 1 - Eliminar implicações
        const step1 = this.eliminateImplications(current);
        current = step1.formula;
        allSteps.push({ title: "Eliminação de Implicações e Bicondicionais", formula: current, steps: step1.steps });
    
        // 2 - Leis de De Morgan / empurrar negações
        const step2 = this.pushNegations(current);
        current = step2.formula;
        allSteps.push({ title: "Aplicação das Leis de De Morgan", formula: current, steps: step2.steps });
    
        // 3 - Padronização (α-renomeação) ANTES do prenex
        const step3a = this.standardizeVariables(current);
        current = step3a.formula;
        allSteps.push({ title: "Padronização de Variáveis Ligadas (α-renomeação)", formula: current, steps: step3a.steps });
        
        // 4 - Movendo quantificadores para prenex
        const step3 = this.toPrenexForm(current);
        current = step3.formula;
        allSteps.push({ title: "Movendo Quantificadores para Forma Prenex", formula: current, steps: step3.steps });
    
        // 5 - Skolemização
        const step3b = this.skolemize(current);
        current = step3b.formula;
        allSteps.push({ title: "Skolemização", formula: current, steps: step3b.steps });
    
        // 6 - CNF
        const step4 = this.toCNF(current);
        current = step4.formula;
        allSteps.push({ title: "Conversão para Forma Normal Conjuntiva (FNC)", formula: current, steps: step4.steps });
    
        // 7 - Forma cláusal (matriz)
        const matrix = getMatrix(current);
        allSteps.push({ title: "Forma Clausal (quantificadores removidos)", formula: matrix, steps: ["Removemos os quantificadores para obter a matriz: $$" + matrix.toString() + "$$"] });
    
        // 8 - Horn
        const horn = analyzeHornClauses(current);
        allSteps.push({ title: "Cláusula de Horn", formula: matrix, steps: ["Verificação: " + horn] });
    
        return allSteps;
    }
    
}

// Função para extrair matriz sem quantificadores
function getMatrix(formula) {
    switch(formula.type) {
        case 'forall':
        case 'exists':
            return getMatrix(formula.left);
        case 'and':
        case 'or':
            return new Formula(formula.type, formula.content, getMatrix(formula.left), getMatrix(formula.right));
        case 'neg':
            return new Formula('neg', formula.content, getMatrix(formula.left));
        default:
            return formula;
    }
}

// Função para extrair cláusulas individuais (disjunções dentro de ANDs)
function extractClauses(f) {
    if (!f) return [];
    if (f.type === 'and') {
        return [...extractClauses(f.left), ...extractClauses(f.right)];
    }
    return [f]; // cada disjunção é uma cláusula
}

// Conta literais positivos em uma cláusula
function countPositiveLiterals(clause) {
    if (!clause) return 0;
    switch (clause.type) {
        case 'or':
            return countPositiveLiterals(clause.left) + countPositiveLiterals(clause.right);
        case 'neg':
            return 0; // literal negado é negativo
        case 'atom':
            return 1; // literal positivo
        default:
            return 0;
    }
}

// Verificação de cláusula de Horn (agora cláusula por cláusula)
function analyzeHornClauses(formula) {
    const matrix = getMatrix(formula);
    const clauses = extractClauses(matrix);

    let hornClauses = [];
    for (let i = 0; i < clauses.length; i++) {
        const posCount = countPositiveLiterals(clauses[i]);
        hornClauses.push({
            clause: clauses[i].toString(),
            positiveLiterals: posCount,
            isHorn: posCount <= 1
        });
    }

    const allHorn = hornClauses.every(c => c.isHorn);

    // Criar array de strings, cada uma com HTML e $$ para MathJax
    let details = [];
    hornClauses.forEach((c, idx) => {
        details.push(`Cláusula ${idx+1}: $$${c.clause}$$ → Literais positivos: ${c.positiveLiterals} → Horn? ${c.isHorn ? "Sim" : "Não"}`);
    });
    details.push(`<b>Resultado final:</b> ${allHorn ? "Sim, todas as cláusulas são Horn" : "Não, nem todas as cláusulas são Horn"}`);

    return details; // retorna array de strings
}

// Função principal de execução
function processFormula(input) {
    try {
        const parser = new FormulaParser(input);
        const formula = parser.parse();
        const transformer = new FormulaTransformer(formula);
        const steps = transformer.transform();
        return steps;
    } catch (e) {
        return [{ title: "Erro", formula: new Formula('atom', ""), steps: [e.message] }];
    }
}

// Renderização com MathJax
function renderSteps(steps) {
    const container = document.getElementById("results");
    container.innerHTML = "";

    steps.forEach((step, index) => {
        const div = document.createElement("div");
        div.className = "step";

        // Título do passo
        div.innerHTML = `<div class="step-title">
                            <div class="step-number">${index+1}</div> ${step.title}
                         </div>`;

        // Subpassos
        const substepsContainer = document.createElement("div");
        substepsContainer.className = "substeps";

        step.steps.forEach(s => {
            const subDiv = document.createElement("div");
            subDiv.className = "substep";
        
            const parts = s.split(/(\$\$.*?\$\$)/g); // separa fórmulas de texto
            parts.forEach(p => {
                if (p.startsWith('$$') && p.endsWith('$$')) {
                    const mathSpan = document.createElement("span");
                    mathSpan.innerHTML = p; // $$ ... $$ será interpretado pelo MathJax
                    subDiv.appendChild(mathSpan);
                } else {
                    subDiv.innerHTML += p; // texto normal em HTML
                }
            });
        
            substepsContainer.appendChild(subDiv);
        });
        

        div.appendChild(substepsContainer);

        // Fórmula final do passo
        const formulaDiv = document.createElement("div");
        formulaDiv.className = "formula-display";
        formulaDiv.innerHTML = `$$${step.formula.toString()}$$`;
        div.appendChild(formulaDiv);

        container.appendChild(div);
    });

    MathJax.typesetPromise();
}

// Evento do botão
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-process").addEventListener("click", () => {
        const input = document.getElementById("formula-input").value;
        const steps = processFormula(input);
        renderSteps(steps);
    });
});
