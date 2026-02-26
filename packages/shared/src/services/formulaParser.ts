// ============================================
// Formula Parser & Evaluator for Calculated Fields
// Supports: arithmetic (+, -, *, /, ()), functions (SUM, AVG, IF, etc.)
// ============================================

import type { DataRecord, FieldType } from '../types';

// ============================================
// Tokenizer
// ============================================

type TokenType = 'number' | 'string' | 'field' | 'operator' | 'function' | 'paren' | 'comma';

interface Token {
    type: TokenType;
    value: string;
}

function tokenize(formula: string, fieldNames: string[]): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    // Sort field names by length (longest first) for greedy matching
    const sortedFields = [...fieldNames].sort((a, b) => b.length - a.length);

    while (i < formula.length) {
        // Skip whitespace
        if (/\s/.test(formula[i])) {
            i++;
            continue;
        }

        // Numbers (including decimals)
        if (/[0-9]/.test(formula[i]) || (formula[i] === '.' && i + 1 < formula.length && /[0-9]/.test(formula[i + 1]))) {
            let num = '';
            while (i < formula.length && (/[0-9]/.test(formula[i]) || formula[i] === '.')) {
                num += formula[i++];
            }
            tokens.push({ type: 'number', value: num });
            continue;
        }

        // String literals
        if (formula[i] === '"' || formula[i] === "'") {
            const quote = formula[i++];
            let str = '';
            while (i < formula.length && formula[i] !== quote) {
                str += formula[i++];
            }
            i++; // closing quote
            tokens.push({ type: 'string', value: str });
            continue;
        }

        // Parentheses
        if (formula[i] === '(' || formula[i] === ')') {
            tokens.push({ type: 'paren', value: formula[i++] });
            continue;
        }

        // Comma
        if (formula[i] === ',') {
            tokens.push({ type: 'comma', value: formula[i++] });
            continue;
        }

        // Operators
        if (['+', '-', '*', '/'].includes(formula[i])) {
            tokens.push({ type: 'operator', value: formula[i++] });
            continue;
        }

        // Comparison operators
        if (['>', '<', '=', '!'].includes(formula[i])) {
            let op = formula[i++];
            if (i < formula.length && formula[i] === '=') {
                op += formula[i++];
            }
            tokens.push({ type: 'operator', value: op });
            continue;
        }

        // Field references in brackets: [Field Name]
        if (formula[i] === '[') {
            i++; // skip [
            let fieldName = '';
            while (i < formula.length && formula[i] !== ']') {
                fieldName += formula[i++];
            }
            i++; // skip ]
            tokens.push({ type: 'field', value: fieldName });
            continue;
        }

        // Identifiers (functions or unbracketed field names)
        if (/[a-zA-Z_]/.test(formula[i])) {
            let ident = '';
            while (i < formula.length && /[a-zA-Z0-9_]/.test(formula[i])) {
                ident += formula[i++];
            }

            // Check if it's a known function
            const upperIdent = ident.toUpperCase();
            const knownFunctions = ['SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'IF', 'CONCAT', 'ABS', 'ROUND', 'SQRT', 'LOG', 'UPPER', 'LOWER', 'LEN'];
            if (knownFunctions.includes(upperIdent)) {
                tokens.push({ type: 'function', value: upperIdent });
                continue;
            }

            // Check if it matches a field name
            const matchedField = sortedFields.find(f => f.toLowerCase() === ident.toLowerCase());
            if (matchedField) {
                tokens.push({ type: 'field', value: matchedField });
                continue;
            }

            // Treat as field reference anyway
            tokens.push({ type: 'field', value: ident });
            continue;
        }

        // Unknown character - skip
        i++;
    }

    return tokens;
}

// ============================================
// AST Node Types
// ============================================

type ASTNode =
    | { type: 'number'; value: number }
    | { type: 'string'; value: string }
    | { type: 'field'; name: string }
    | { type: 'binary'; operator: string; left: ASTNode; right: ASTNode }
    | { type: 'unary'; operator: string; operand: ASTNode }
    | { type: 'function'; name: string; args: ASTNode[] };

// ============================================
// Parser (Recursive Descent)
// ============================================

function parse(tokens: Token[]): ASTNode {
    let pos = 0;

    function peek(): Token | undefined {
        return tokens[pos];
    }

    function consume(): Token {
        return tokens[pos++];
    }

    function parseExpression(): ASTNode {
        return parseComparison();
    }

    function parseComparison(): ASTNode {
        let left = parseAddSub();
        while (peek() && peek()!.type === 'operator' && ['>', '<', '>=', '<=', '=', '==', '!='].includes(peek()!.value)) {
            const op = consume().value;
            const right = parseAddSub();
            left = { type: 'binary', operator: op, left, right };
        }
        return left;
    }

    function parseAddSub(): ASTNode {
        let left = parseMulDiv();
        while (peek() && peek()!.type === 'operator' && ['+', '-'].includes(peek()!.value)) {
            const op = consume().value;
            const right = parseMulDiv();
            left = { type: 'binary', operator: op, left, right };
        }
        return left;
    }

    function parseMulDiv(): ASTNode {
        let left = parseUnary();
        while (peek() && peek()!.type === 'operator' && ['*', '/'].includes(peek()!.value)) {
            const op = consume().value;
            const right = parseUnary();
            left = { type: 'binary', operator: op, left, right };
        }
        return left;
    }

    function parseUnary(): ASTNode {
        if (peek() && peek()!.type === 'operator' && peek()!.value === '-') {
            consume();
            const operand = parsePrimary();
            return { type: 'unary', operator: '-', operand };
        }
        return parsePrimary();
    }

    function parsePrimary(): ASTNode {
        const token = peek();
        if (!token) throw new Error('Unexpected end of formula');

        if (token.type === 'number') {
            consume();
            return { type: 'number', value: parseFloat(token.value) };
        }

        if (token.type === 'string') {
            consume();
            return { type: 'string', value: token.value };
        }

        if (token.type === 'field') {
            consume();
            return { type: 'field', name: token.value };
        }

        if (token.type === 'function') {
            const funcName = consume().value;
            // Expect '('
            if (!peek() || peek()!.value !== '(') throw new Error(`Expected ( after ${funcName}`);
            consume(); // eat (

            const args: ASTNode[] = [];
            if (peek() && peek()!.value !== ')') {
                args.push(parseExpression());
                while (peek() && peek()!.type === 'comma') {
                    consume(); // eat ,
                    args.push(parseExpression());
                }
            }
            // Expect ')'
            if (!peek() || peek()!.value !== ')') throw new Error(`Expected ) after ${funcName} arguments`);
            consume(); // eat )

            return { type: 'function', name: funcName, args };
        }

        if (token.type === 'paren' && token.value === '(') {
            consume(); // eat (
            const expr = parseExpression();
            if (!peek() || peek()!.value !== ')') throw new Error('Expected closing parenthesis');
            consume(); // eat )
            return expr;
        }

        throw new Error(`Unexpected token: ${token.value}`);
    }

    const ast = parseExpression();
    if (pos < tokens.length) {
        throw new Error(`Unexpected token at end: ${tokens[pos].value}`);
    }
    return ast;
}

// ============================================
// Evaluator
// ============================================

function evaluate(ast: ASTNode, row: DataRecord, allData: DataRecord[]): unknown {
    switch (ast.type) {
        case 'number':
            return ast.value;
        case 'string':
            return ast.value;
        case 'field':
            return row[ast.name];
        case 'unary':
            if (ast.operator === '-') return -(Number(evaluate(ast.operand, row, allData)) || 0);
            return 0;
        case 'binary': {
            const leftVal = evaluate(ast.left, row, allData);
            const rightVal = evaluate(ast.right, row, allData);
            const l = Number(leftVal) || 0;
            const r = Number(rightVal) || 0;

            switch (ast.operator) {
                case '+':
                    // String concatenation if either side is string
                    if (typeof leftVal === 'string' && typeof rightVal === 'string') return leftVal + rightVal;
                    return l + r;
                case '-': return l - r;
                case '*': return l * r;
                case '/': return r !== 0 ? l / r : 0;
                case '>': return l > r ? 1 : 0;
                case '<': return l < r ? 1 : 0;
                case '>=': return l >= r ? 1 : 0;
                case '<=': return l <= r ? 1 : 0;
                case '=':
                case '==': return String(leftVal) === String(rightVal) ? 1 : 0;
                case '!=': return String(leftVal) !== String(rightVal) ? 1 : 0;
                default: return 0;
            }
        }
        case 'function': {
            const funcName = ast.name;
            const args = ast.args;

            switch (funcName) {
                case 'IF': {
                    if (args.length < 2) throw new Error('IF requires at least 2 arguments');
                    const condition = evaluate(args[0], row, allData);
                    if (condition && condition !== 0) {
                        return evaluate(args[1], row, allData);
                    }
                    return args.length >= 3 ? evaluate(args[2], row, allData) : 0;
                }
                case 'ABS': return Math.abs(Number(evaluate(args[0], row, allData)) || 0);
                case 'ROUND': {
                    const val = Number(evaluate(args[0], row, allData)) || 0;
                    const decimals = args.length > 1 ? Number(evaluate(args[1], row, allData)) || 0 : 0;
                    return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);
                }
                case 'SQRT': return Math.sqrt(Math.abs(Number(evaluate(args[0], row, allData)) || 0));
                case 'LOG': return Math.log(Math.max(Number(evaluate(args[0], row, allData)) || 1, 0.001));
                case 'UPPER': return String(evaluate(args[0], row, allData)).toUpperCase();
                case 'LOWER': return String(evaluate(args[0], row, allData)).toLowerCase();
                case 'LEN': return String(evaluate(args[0], row, allData)).length;
                case 'CONCAT': return args.map(a => String(evaluate(a, row, allData))).join('');
                case 'SUM': {
                    // Aggregate: sum a field across all rows
                    if (args[0].type === 'field') {
                        return allData.reduce((sum, r) => sum + (Number(r[args[0].type === 'field' ? (args[0] as { name: string }).name : '']) || 0), 0);
                    }
                    return Number(evaluate(args[0], row, allData)) || 0;
                }
                case 'AVG': {
                    if (args[0].type === 'field') {
                        const fieldName = (args[0] as { name: string }).name;
                        const values = allData.map(r => Number(r[fieldName]) || 0);
                        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
                    }
                    return Number(evaluate(args[0], row, allData)) || 0;
                }
                case 'MIN': {
                    if (args[0].type === 'field') {
                        const fieldName = (args[0] as { name: string }).name;
                        const values = allData.map(r => Number(r[fieldName]) || 0);
                        return values.length > 0 ? Math.min(...values) : 0;
                    }
                    return Number(evaluate(args[0], row, allData)) || 0;
                }
                case 'MAX': {
                    if (args[0].type === 'field') {
                        const fieldName = (args[0] as { name: string }).name;
                        const values = allData.map(r => Number(r[fieldName]) || 0);
                        return values.length > 0 ? Math.max(...values) : 0;
                    }
                    return Number(evaluate(args[0], row, allData)) || 0;
                }
                case 'COUNT': {
                    return allData.length;
                }
                default:
                    throw new Error(`Unknown function: ${funcName}`);
            }
        }
    }
}

// ============================================
// Public API
// ============================================

/**
 * Parse a formula string and return the referenced field names
 */
export function parseFormula(formula: string, fieldNames: string[]): { referencedFields: string[]; error?: string } {
    try {
        const tokens = tokenize(formula, fieldNames);
        parse(tokens); // validates syntax

        const referencedFields = tokens
            .filter(t => t.type === 'field')
            .map(t => t.value)
            .filter((v, i, a) => a.indexOf(v) === i); // unique

        return { referencedFields };
    } catch (e) {
        return { referencedFields: [], error: e instanceof Error ? e.message : 'Invalid formula' };
    }
}

/**
 * Evaluate a formula for every row in the dataset
 */
export function evaluateFormula(
    formula: string,
    data: DataRecord[],
    fieldNames: string[]
): { values: unknown[]; resultType: FieldType; error?: string } {
    try {
        const tokens = tokenize(formula, fieldNames);
        const ast = parse(tokens);

        const values = data.map(row => {
            try {
                return evaluate(ast, row, data);
            } catch {
                return null;
            }
        });

        // Infer result type
        const nonNullValues = values.filter(v => v !== null && v !== undefined);
        let resultType: FieldType = 'nominal';

        if (nonNullValues.length > 0) {
            const allNumbers = nonNullValues.every(v => typeof v === 'number' && !isNaN(v as number));
            if (allNumbers) {
                resultType = 'quantitative';
            }
        }

        return { values, resultType };
    } catch (e) {
        return { values: [], resultType: 'nominal', error: e instanceof Error ? e.message : 'Evaluation error' };
    }
}

/**
 * Validate a formula without executing it
 */
export function validateFormula(formula: string, fieldNames: string[]): { valid: boolean; error?: string } {
    if (!formula.trim()) return { valid: false, error: 'Formula cannot be empty' };

    try {
        const tokens = tokenize(formula, fieldNames);
        parse(tokens);

        // Check that referenced fields exist
        const referencedFields = tokens.filter(t => t.type === 'field').map(t => t.value);
        const fieldNamesLower = fieldNames.map(f => f.toLowerCase());
        for (const ref of referencedFields) {
            if (!fieldNamesLower.includes(ref.toLowerCase())) {
                return { valid: false, error: `Unknown field: "${ref}"` };
            }
        }

        return { valid: true };
    } catch (e) {
        return { valid: false, error: e instanceof Error ? e.message : 'Invalid formula' };
    }
}
